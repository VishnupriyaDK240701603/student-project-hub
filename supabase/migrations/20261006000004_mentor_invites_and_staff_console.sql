-- Migration 20261006000004: Mentors and Staff Console
-- Prompt 13 (Spec F12, Invariant 4, APP_LIMITS.maxPendingMentorInvitesPerStaff = 10)

-- 1. Enhance mentor_invites table
ALTER TABLE mentor_invites ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE mentor_invites ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE mentor_invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mentor_invites_staff_status ON mentor_invites(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_mentor_invites_expires_at ON mentor_invites(expires_at) WHERE status = 'selected';
CREATE INDEX IF NOT EXISTS idx_mentor_invites_room_id ON mentor_invites(room_id);

-- 2. RLS Policies for mentor_invites
CREATE POLICY mentor_invites_select_staff_or_team ON mentor_invites
  FOR SELECT USING (
    auth.uid() = staff_id OR
    auth.uid() = invited_by OR
    is_request_lead(request_id, auth.uid()) OR
    (room_id IS NOT NULL AND (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid())))
  );

CREATE POLICY mentor_invites_insert_lead_or_permitted ON mentor_invites
  FOR INSERT WITH CHECK (
    auth.uid() = invited_by AND
    (SELECT kind FROM profiles WHERE id = staff_id) = 'staff'
  );

CREATE POLICY mentor_invites_update_staff_or_lead ON mentor_invites
  FOR UPDATE USING (
    auth.uid() = staff_id OR auth.uid() = invited_by
  );

-- 3. Atomic Stored Procedure: invite_staff_mentor
-- Enforces: caller permission, staff kind check, active mentor check, and MAX 10 PENDING INVITES limit.
CREATE OR REPLACE FUNCTION invite_staff_mentor(
  p_room_id UUID,
  p_inviter_id UUID,
  p_staff_id UUID,
  p_expires_at TIMESTAMPTZ,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room RECORD;
  v_inviter_member RECORD;
  v_staff_profile RECORD;
  v_pending_count INT;
  v_invite_id UUID;
  v_request_title TEXT;
BEGIN
  -- 1. Check room exists
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project room not found');
  END IF;

  -- 2. Check inviter permission (must be lead OR have can_invite_mentors)
  IF v_room.lead_id != p_inviter_id THEN
    SELECT * INTO v_inviter_member FROM room_members
    WHERE room_id = p_room_id AND user_id = p_inviter_id AND status = 'active';

    IF v_inviter_member IS NULL OR NOT v_inviter_member.can_invite_mentors THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied: must be team lead or have mentor invite permission');
    END IF;
  END IF;

  -- 3. Verify target is a valid, active staff member
  SELECT * INTO v_staff_profile FROM profiles WHERE id = p_staff_id;
  IF v_staff_profile IS NULL OR v_staff_profile.kind != 'staff' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not a staff member');
  END IF;

  IF v_staff_profile.is_blocked OR v_staff_profile.is_deactivated THEN
    RETURN jsonb_build_object('success', false, 'error', 'This staff member is currently inactive or restricted');
  END IF;

  -- 4. Check if already an active mentor in this room
  IF EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id AND user_id = p_staff_id AND role = 'mentor' AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Staff member is already an active mentor in this room');
  END IF;

  -- 5. Check if already has a pending invite for this room
  IF EXISTS (
    SELECT 1 FROM mentor_invites
    WHERE (room_id = p_room_id OR request_id = v_room.request_id)
      AND staff_id = p_staff_id
      AND status = 'selected'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending invitation has already been sent to this staff member');
  END IF;

  -- 6. SERVER-ENFORCED LIMIT: At most 10 pending invites per staff member
  -- (Prompt 13 requirement 3 / APP_LIMITS.maxPendingMentorInvitesPerStaff = 10)
  SELECT COUNT(*) INTO v_pending_count
  FROM mentor_invites
  WHERE staff_id = p_staff_id
    AND status = 'selected'
    AND expires_at > NOW();

  IF v_pending_count >= 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This staff member already has the maximum of 10 pending mentor invitations. Please choose another staff member.'
    );
  END IF;

  -- 7. Validate expiration timestamp
  IF p_expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation expiry must be in the future');
  END IF;

  -- 8. Create mentor invitation
  INSERT INTO mentor_invites (
    request_id,
    room_id,
    staff_id,
    invited_by,
    status,
    expires_at,
    note
  )
  VALUES (
    v_room.request_id,
    p_room_id,
    p_staff_id,
    p_inviter_id,
    'selected',
    p_expires_at,
    p_note
  )
  RETURNING id INTO v_invite_id;

  -- Fetch project title for notification
  SELECT title INTO v_request_title FROM team_requests WHERE id = v_room.request_id;
  IF v_request_title IS NULL THEN
    v_request_title := 'Project Room';
  END IF;

  -- 9. Send in-app notification to staff member
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    p_staff_id,
    'mentor_invite_received',
    'New Project Mentor Invitation',
    'You have been invited to mentor team "' || v_request_title || '". Review in your Staff Mentor Console.',
    '/staff/mentor-inbox'
  );

  -- 10. Write audit log (IDs only)
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_inviter_id,
    'mentor.invite_sent',
    p_room_id::text,
    jsonb_build_object(
      'invite_id', v_invite_id,
      'staff_id', p_staff_id,
      'room_id', p_room_id,
      'expires_at', p_expires_at
    )
  );

  RETURN jsonb_build_object('success', true, 'invite_id', v_invite_id);
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic Stored Procedure: respond_to_mentor_invite
-- Staff member accepts or rejects mentor invite.
-- When accepted: joins room as role 'mentor', does NOT increase headcount, and CANNOT become lead.
CREATE OR REPLACE FUNCTION respond_to_mentor_invite(
  p_invite_id UUID,
  p_staff_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite RECORD;
  v_room_id UUID;
  v_request_title TEXT;
  v_staff_name TEXT;
  v_member RECORD;
BEGIN
  -- 1. Lock and fetch invite
  SELECT * INTO v_invite FROM mentor_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mentor invitation not found');
  END IF;

  IF v_invite.staff_id != p_staff_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: This invitation is not addressed to you');
  END IF;

  IF v_invite.status != 'selected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation is no longer pending (status: ' || v_invite.status || ')');
  END IF;

  -- 2. Check if expired
  IF v_invite.expires_at <= NOW() THEN
    UPDATE mentor_invites SET status = 'expired', updated_at = NOW() WHERE id = p_invite_id;

    -- Notify inviter
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      v_invite.invited_by,
      'mentor_invite_expired',
      'Mentor Invitation Expired',
      'Your mentor invitation to staff member has expired without response.',
      '/rooms/' || COALESCE(v_invite.room_id::text, '')
    );

    RETURN jsonb_build_object('success', false, 'error', 'This mentor invitation has expired');
  END IF;

  -- Resolve room_id
  IF v_invite.room_id IS NOT NULL THEN
    v_room_id := v_invite.room_id;
  ELSE
    SELECT id INTO v_room_id FROM rooms WHERE request_id = v_invite.request_id;
  END IF;

  SELECT display_name INTO v_staff_name FROM profiles WHERE id = p_staff_id;
  SELECT title INTO v_request_title FROM team_requests WHERE id = v_invite.request_id;

  -- 3. Handle Rejection
  IF NOT p_accept THEN
    UPDATE mentor_invites SET status = 'rejected', updated_at = NOW() WHERE id = p_invite_id;

    -- Notify inviter
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      v_invite.invited_by,
      'mentor_invite_declined',
      'Mentor Invitation Declined',
      v_staff_name || ' declined the invitation to mentor "' || COALESCE(v_request_title, 'your team') || '".',
      '/rooms/' || COALESCE(v_room_id::text, '')
    );

    -- Audit log
    INSERT INTO audit_log (actor_id, action, target, metadata)
    VALUES (
      p_staff_id,
      'mentor.invite_declined',
      p_invite_id::text,
      jsonb_build_object('room_id', v_room_id, 'staff_id', p_staff_id)
    );

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  -- 4. Handle Acceptance
  UPDATE mentor_invites SET status = 'accepted', updated_at = NOW() WHERE id = p_invite_id;

  -- Add to room_members as role 'mentor' with active status and no lead/creation permissions
  IF v_room_id IS NOT NULL THEN
    INSERT INTO room_members (
      room_id,
      user_id,
      role,
      status,
      can_edit_tasks,
      can_set_deadlines,
      can_invite_mentors
    )
    VALUES (
      v_room_id,
      p_staff_id,
      'mentor',
      'active',
      FALSE,
      FALSE,
      FALSE
    )
    ON CONFLICT (room_id, user_id)
    DO UPDATE SET
      role = 'mentor',
      status = 'active',
      can_edit_tasks = FALSE,
      can_set_deadlines = FALSE,
      can_invite_mentors = FALSE,
      updated_at = NOW();

    -- Post to room_events
    INSERT INTO room_events (room_id, actor_id, event_type, metadata)
    VALUES (
      v_room_id,
      p_staff_id,
      'mentor_joined',
      jsonb_build_object(
        'staff_id', p_staff_id,
        'staff_name', v_staff_name
      )
    );

    -- Notify team members
    FOR v_member IN SELECT user_id FROM room_members WHERE room_id = v_room_id AND user_id != p_staff_id LOOP
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_member.user_id,
        'mentor_joined_team',
        'Staff Mentor Joined Room!',
        v_staff_name || ' has joined as your project mentor.',
        '/rooms/' || v_room_id
      );
    END LOOP;
  END IF;

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_staff_id,
    'mentor.invite_accepted',
    p_invite_id::text,
    jsonb_build_object('room_id', v_room_id, 'staff_id', p_staff_id)
  );

  RETURN jsonb_build_object('success', true, 'status', 'accepted', 'room_id', v_room_id);
END;
$$ LANGUAGE plpgsql;

-- 5. Atomic Stored Procedure: expire_stale_mentor_invites
-- Auto-rejects expired mentor invites and notifies inviters. Idempotent & time-travel testable.
CREATE OR REPLACE FUNCTION expire_stale_mentor_invites(
  p_current_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite RECORD;
  v_staff_name TEXT;
  v_expired_count INT := 0;
  v_expired_ids UUID[] := '{}';
BEGIN
  FOR v_invite IN
    SELECT mi.*, p.display_name AS staff_name
    FROM mentor_invites mi
    JOIN profiles p ON p.id = mi.staff_id
    WHERE mi.status = 'selected'
      AND mi.expires_at <= p_current_time
  LOOP
    -- Mark as expired
    UPDATE mentor_invites SET status = 'expired', updated_at = NOW() WHERE id = v_invite.id;

    -- Notify inviter
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      v_invite.invited_by,
      'mentor_invite_expired',
      'Mentor Invitation Expired',
      'Your mentor invitation to ' || v_invite.staff_name || ' has expired without response.',
      '/rooms/' || COALESCE(v_invite.room_id::text, '')
    );

    v_expired_count := v_expired_count + 1;
    v_expired_ids := array_append(v_expired_ids, v_invite.id);
  END LOOP;

  -- Audit log
  IF v_expired_count > 0 THEN
    INSERT INTO audit_log (actor_id, action, target, metadata)
    VALUES (
      NULL,
      'mentor_invites.expired_cleanup',
      'mentor_invites',
      jsonb_build_object(
        'expired_count', v_expired_count,
        'expired_ids', v_expired_ids,
        'executed_at', p_current_time
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'expired_ids', v_expired_ids
  );
END;
$$ LANGUAGE plpgsql;
