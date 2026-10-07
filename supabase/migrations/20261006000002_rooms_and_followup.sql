-- Migration 20261006000002: Rooms, Follow-up Requests, and File Retention
-- Prompt 10

-- 1. Add room_id to team_requests for follow-up requests linked to an existing room
ALTER TABLE team_requests ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_requests_room_id ON team_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_application_files_delete_after ON application_files(delete_after) WHERE delete_after IS NOT NULL;

-- 2. Enhanced create_room_if_ready function supporting follow-up requests and idempotent room creation
DROP FUNCTION IF EXISTS create_room_if_ready(UUID);
DROP FUNCTION IF EXISTS close_request(UUID, UUID);
DROP FUNCTION IF EXISTS accept_invite(UUID);

CREATE OR REPLACE FUNCTION create_room_if_ready(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_lead_id UUID;
  v_existing_room_id UUID;
  v_app RECORD;
BEGIN
  -- Fetch request details
  SELECT lead_id, room_id INTO v_lead_id, v_existing_room_id FROM team_requests WHERE id = p_request_id;
  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- If request is a follow-up already linked to an existing room, use that room
  IF v_existing_room_id IS NOT NULL THEN
    v_room_id := v_existing_room_id;
  ELSE
    -- Check if a room was already created for this initial request
    SELECT id INTO v_room_id FROM rooms WHERE request_id = p_request_id;
    
    -- Exactly one room created per team
    IF v_room_id IS NULL THEN
      INSERT INTO rooms (request_id, lead_id)
      VALUES (p_request_id, v_lead_id)
      RETURNING id INTO v_room_id;

      -- Link initial request to room
      UPDATE team_requests SET room_id = v_room_id WHERE id = p_request_id;

      -- Add Lead as Lead Member with full permissions
      INSERT INTO room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
      VALUES (v_room_id, v_lead_id, 'lead', 'active', TRUE, TRUE, TRUE)
      ON CONFLICT (room_id, user_id) DO NOTHING;
    END IF;
  END IF;

  -- Add all currently accepted applicants to room_members
  FOR v_app IN SELECT applicant_id FROM applications WHERE request_id = p_request_id AND status = 'accepted' LOOP
    INSERT INTO room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
    VALUES (v_room_id, v_app.applicant_id, 'member', 'active', FALSE, FALSE, FALSE)
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Enhanced close_request function enforcing 30-day retention for unselected applicants' files
CREATE OR REPLACE FUNCTION close_request(p_request_id UUID, p_lead_id UUID)
RETURNS UUID AS $$
DECLARE
  v_req RECORD;
  v_room_id UUID;
BEGIN
  SELECT * INTO v_req FROM team_requests WHERE id = p_request_id AND lead_id = p_lead_id;
  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Request not found or user is not lead';
  END IF;

  -- 1. Mark request as closed
  UPDATE team_requests 
  SET status = 'closed', 
      closed_at = NOW(), 
      updated_at = NOW() 
  WHERE id = p_request_id;

  -- 2. Form room if ready with lead and accepted members
  v_room_id := create_room_if_ready(p_request_id);

  -- 3. Set delete_after = closed_at + 30 days for unselected applicants' files (Invariant 9)
  UPDATE application_files
  SET delete_after = NOW() + INTERVAL '30 days'
  WHERE application_id IN (
    SELECT id FROM applications 
    WHERE request_id = p_request_id 
      AND status != 'accepted'
  );

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Enhanced accept_invite function with room addition and follow-up support
CREATE OR REPLACE FUNCTION accept_invite(p_application_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_app RECORD;
  v_req RECORD;
  v_accepted_count INT;
  v_room_id UUID;
  v_member RECORD;
BEGIN
  -- Select Application
  SELECT * INTO v_app FROM applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.status != 'selected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite is not in selected state');
  END IF;

  IF v_app.expires_at IS NOT NULL AND v_app.expires_at <= NOW() THEN
    UPDATE applications SET status = 'expired' WHERE id = p_application_id;
    RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
  END IF;

  -- Lock team request row
  SELECT * INTO v_req FROM team_requests WHERE id = v_app.request_id FOR UPDATE;
  
  -- Calculate accepted count dynamically
  SELECT COUNT(*) INTO v_accepted_count FROM applications WHERE request_id = v_req.id AND status = 'accepted';

  IF v_accepted_count >= v_req.headcount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team is already full');
  END IF;

  -- Mark application as accepted
  UPDATE applications SET status = 'accepted', updated_at = NOW() WHERE id = p_application_id;
  v_accepted_count := v_accepted_count + 1;

  -- Check if team reached headcount or is closed or is a follow-up
  IF v_accepted_count >= v_req.headcount THEN
    UPDATE team_requests SET status = 'full', updated_at = NOW() WHERE id = v_req.id;
    v_room_id := create_room_if_ready(v_req.id);
  ELSIF v_req.status = 'closed' OR v_req.room_id IS NOT NULL THEN
    v_room_id := create_room_if_ready(v_req.id);
  END IF;

  -- If room exists, ensure member is added to room_members immediately
  IF v_room_id IS NOT NULL THEN
    INSERT INTO room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
    VALUES (v_room_id, v_app.applicant_id, 'member', 'active', FALSE, FALSE, FALSE)
    ON CONFLICT (room_id, user_id) DO NOTHING;

    -- If follow-up request, notify existing room members
    IF v_req.room_id IS NOT NULL THEN
      FOR v_member IN SELECT user_id FROM room_members WHERE room_id = v_room_id AND user_id != v_app.applicant_id LOOP
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (
          v_member.user_id,
          'room_member_joined',
          'New Team Member Joined!',
          'A new teammate has joined your project room from a follow-up request.',
          '/rooms/' || v_room_id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'room_id', v_room_id);
END;
$$ LANGUAGE plpgsql;
