-- Migration 20261006000003: Room Permissions, Lead Swap, and Member Removal
-- Prompt 12 (Spec F7, Invariants 6 and 8)

-- 1. RLS Policies for room_events
CREATE POLICY room_events_select_members ON room_events
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

CREATE POLICY room_events_insert_members ON room_events
  FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND actor_id = auth.uid());

-- 2. RLS Policies for lead_transfers
CREATE POLICY lead_transfers_select_participants ON lead_transfers
  FOR SELECT USING (auth.uid() = current_lead_id OR auth.uid() = target_lead_id);

CREATE POLICY lead_transfers_insert_participants ON lead_transfers
  FOR INSERT WITH CHECK (auth.uid() = current_lead_id OR auth.uid() = target_lead_id);

CREATE POLICY lead_transfers_update_participants ON lead_transfers
  FOR UPDATE USING (auth.uid() = current_lead_id OR auth.uid() = target_lead_id);

-- 3. Atomic Stored Procedure: execute_lead_swap
-- Moves room leadership, request leadership, applicants and waitlist atomically.
CREATE OR REPLACE FUNCTION execute_lead_swap(
  p_transfer_id UUID,
  p_responder_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer RECORD;
  v_room RECORD;
  v_new_lead_profile RECORD;
  v_req RECORD;
BEGIN
  -- 1. Lock and fetch transfer
  SELECT * INTO v_transfer FROM lead_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_transfer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead transfer request not found');
  END IF;

  IF v_transfer.status NOT IN ('applied', 'selected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead transfer request is no longer pending');
  END IF;

  -- 2. Verify responder authorization based on flow
  -- Flow A: Lead offered (status = 'selected') -> target must respond
  -- Flow B: Teammate requested (status = 'applied') -> current lead must respond
  IF v_transfer.status = 'selected' AND v_transfer.target_lead_id != p_responder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the invited member can accept or decline this offer');
  END IF;

  IF v_transfer.status = 'applied' AND v_transfer.current_lead_id != p_responder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the current lead can approve or reject this request');
  END IF;

  -- 3. Handle Rejection / Decline
  IF NOT p_accept THEN
    UPDATE lead_transfers SET status = 'rejected' WHERE id = p_transfer_id;

    INSERT INTO room_events (room_id, actor_id, event_type, metadata)
    VALUES (
      v_transfer.room_id,
      p_responder_id,
      'lead_swap_declined',
      jsonb_build_object(
        'transfer_id', p_transfer_id,
        'current_lead_id', v_transfer.current_lead_id,
        'target_lead_id', v_transfer.target_lead_id
      )
    );

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  -- 4. Verify candidate eligibility
  SELECT * INTO v_new_lead_profile FROM profiles WHERE id = v_transfer.target_lead_id;
  IF v_new_lead_profile IS NULL OR v_new_lead_profile.is_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is blocked or invalid');
  END IF;

  -- Both must still be active members in the room
  IF NOT EXISTS (SELECT 1 FROM room_members WHERE room_id = v_transfer.room_id AND user_id = v_transfer.current_lead_id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current lead is no longer active in this room');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM room_members WHERE room_id = v_transfer.room_id AND user_id = v_transfer.target_lead_id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target lead is no longer active in this room');
  END IF;

  -- 5. Atomic Swap Execution
  -- A. Update room lead_id
  UPDATE rooms SET lead_id = v_transfer.target_lead_id, updated_at = NOW() WHERE id = v_transfer.room_id;

  -- B. Update team_requests lead_id for the initial request and any follow-up requests linked to this room
  UPDATE team_requests
  SET lead_id = v_transfer.target_lead_id, updated_at = NOW()
  WHERE room_id = v_transfer.room_id OR id = (SELECT request_id FROM rooms WHERE id = v_transfer.room_id);

  -- C. Update room_members roles and permissions
  -- Previous lead becomes regular member
  UPDATE room_members
  SET role = 'member',
      can_edit_tasks = TRUE,
      can_set_deadlines = FALSE,
      can_invite_mentors = FALSE,
      updated_at = NOW()
  WHERE room_id = v_transfer.room_id AND user_id = v_transfer.current_lead_id;

  -- New lead becomes lead with full permissions
  UPDATE room_members
  SET role = 'lead',
      can_edit_tasks = TRUE,
      can_set_deadlines = TRUE,
      can_invite_mentors = TRUE,
      updated_at = NOW()
  WHERE room_id = v_transfer.room_id AND user_id = v_transfer.target_lead_id;

  -- D. Update transfer status
  UPDATE lead_transfers SET status = 'accepted' WHERE id = p_transfer_id;

  -- E. Post to room_events visible to all room members
  INSERT INTO room_events (room_id, actor_id, event_type, metadata)
  VALUES (
    v_transfer.room_id,
    p_responder_id,
    'lead_swapped',
    jsonb_build_object(
      'transfer_id', p_transfer_id,
      'old_lead_id', v_transfer.current_lead_id,
      'new_lead_id', v_transfer.target_lead_id
    )
  );

  -- F. Write audit log entry (IDs only)
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_responder_id,
    'room.lead_swapped',
    v_transfer.room_id::text,
    jsonb_build_object(
      'old_lead_id', v_transfer.current_lead_id,
      'new_lead_id', v_transfer.target_lead_id,
      'transfer_id', p_transfer_id
    )
  );

  RETURN jsonb_build_object('success', true, 'status', 'accepted', 'new_lead_id', v_transfer.target_lead_id);
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic Stored Procedure: remove_room_member
-- Invariant 8: Removal needs a written reason (minimum length 10 chars) visible to all members.
-- Realtime and RLS access revoked immediately. Messages and files remain attributed.
CREATE OR REPLACE FUNCTION remove_room_member(
  p_room_id UUID,
  p_lead_id UUID,
  p_target_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room RECORD;
  v_trimmed_reason TEXT;
BEGIN
  -- 1. Verify caller is current lead of the room
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  IF v_room.lead_id != p_lead_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the project lead can remove team members');
  END IF;

  -- Cannot remove self (lead must swap leadership or leave room)
  IF p_target_user_id = p_lead_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'The project lead cannot be removed. Transfer leadership first.');
  END IF;

  -- 2. Validate written reason (minimum 10 characters)
  v_trimmed_reason := trim(p_reason);
  IF v_trimmed_reason IS NULL OR length(v_trimmed_reason) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'A written reason of at least 10 characters is required for member removal');
  END IF;

  -- 3. Verify target user is an active member
  IF NOT EXISTS (SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = p_target_user_id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not an active member of this room');
  END IF;

  -- 4. Update member status to removed with reason
  UPDATE room_members
  SET status = 'removed',
      removed_reason = v_trimmed_reason,
      updated_at = NOW()
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- 5. Post to room_events feed visible to all members
  INSERT INTO room_events (room_id, actor_id, event_type, metadata)
  VALUES (
    p_room_id,
    p_lead_id,
    'member_removed',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'reason', v_trimmed_reason
    )
  );

  -- 6. Notify removed member
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    p_target_user_id,
    'room_member_removed',
    'Removed from Project Room',
    'You have been removed from the project room: ' || substring(v_trimmed_reason from 1 for 60),
    '/rooms'
  );

  -- 7. Audit log (IDs only, no sensitive content)
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_lead_id,
    'room.member_removed',
    p_room_id::text,
    jsonb_build_object(
      'target_user_id', p_target_user_id
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 5. Atomic Stored Procedure: leave_room ("Delete room" for member)
CREATE OR REPLACE FUNCTION leave_room(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room RECORD;
  v_other_active_count INT;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  -- Check if user is active member
  IF NOT EXISTS (SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not an active member of this room');
  END IF;

  -- If user is the lead, they must transfer leadership if others remain
  IF v_room.lead_id = p_user_id THEN
    SELECT COUNT(*) INTO v_other_active_count
    FROM room_members
    WHERE room_id = p_room_id AND user_id != p_user_id AND status = 'active' AND role != 'mentor';

    IF v_other_active_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Project lead must transfer leadership to another member before leaving');
    END IF;
  END IF;

  -- Update status to left
  UPDATE room_members
  SET status = 'left',
      updated_at = NOW()
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Log event
  INSERT INTO room_events (room_id, actor_id, event_type, metadata)
  VALUES (
    p_room_id,
    p_user_id,
    'member_left',
    jsonb_build_object('user_id', p_user_id)
  );

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_user_id,
    'room.member_left',
    p_room_id::text,
    jsonb_build_object('user_id', p_user_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 6. Atomic Stored Procedure: re_add_room_member
-- Invariant: Lead (or member with can_invite_mentors) can re-add only someone who previously accepted, never a blocked user.
CREATE OR REPLACE FUNCTION re_add_room_member(
  p_room_id UUID,
  p_actor_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room RECORD;
  v_actor_member RECORD;
  v_target_profile RECORD;
  v_had_accepted BOOLEAN;
BEGIN
  -- 1. Check room exists
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  -- 2. Verify actor permissions (must be lead OR have can_invite_mentors)
  SELECT * INTO v_actor_member FROM room_members WHERE room_id = p_room_id AND user_id = p_actor_id AND status = 'active';
  IF v_actor_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actor is not an active member of this room');
  END IF;

  IF v_room.lead_id != p_actor_id AND NOT v_actor_member.can_invite_mentors THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: must be lead or have re-add permission');
  END IF;

  -- 3. Verify target user is NOT blocked
  SELECT * INTO v_target_profile FROM profiles WHERE id = p_target_user_id;
  IF v_target_profile IS NULL OR v_target_profile.is_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is blocked or does not exist');
  END IF;

  -- 4. Invariant: Re-adding someone who never accepted is refused.
  -- Check if user previously was in room_members OR had an accepted application for a request linked to this room
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id AND user_id = p_target_user_id
  ) OR EXISTS (
    SELECT 1 FROM applications a
    JOIN team_requests tr ON tr.id = a.request_id
    WHERE (tr.room_id = p_room_id OR tr.id = v_room.request_id)
      AND a.applicant_id = p_target_user_id
      AND a.status = 'accepted'
  ) INTO v_had_accepted;

  IF NOT v_had_accepted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Re-adding someone who never accepted an invitation is refused');
  END IF;

  -- 5. Restore member to active status
  INSERT INTO room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors, removed_reason)
  VALUES (p_room_id, p_target_user_id, 'member', 'active', FALSE, FALSE, FALSE, NULL)
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET
    status = 'active',
    role = 'member',
    removed_reason = NULL,
    updated_at = NOW();

  -- 6. Log event
  INSERT INTO room_events (room_id, actor_id, event_type, metadata)
  VALUES (
    p_room_id,
    p_actor_id,
    'member_readded',
    jsonb_build_object('user_id', p_target_user_id, 'readded_by', p_actor_id)
  );

  -- 7. Notify target user
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    p_target_user_id,
    'room_member_readded',
    'Re-added to Project Room',
    'You have been re-added to your project room.',
    '/rooms/' || p_room_id
  );

  -- 8. Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_actor_id,
    'room.member_readded',
    p_room_id::text,
    jsonb_build_object('target_user_id', p_target_user_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 7. Atomic Stored Procedure: update_member_permissions
CREATE OR REPLACE FUNCTION update_member_permissions(
  p_room_id UUID,
  p_lead_id UUID,
  p_target_user_id UUID,
  p_can_edit_tasks BOOLEAN,
  p_can_set_deadlines BOOLEAN,
  p_can_invite_mentors BOOLEAN
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room RECORD;
  v_target_member RECORD;
BEGIN
  -- Verify caller is lead
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  IF v_room.lead_id != p_lead_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the project lead can update member permissions');
  END IF;

  -- Target cannot be the lead
  IF p_target_user_id = p_lead_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead permissions cannot be modified directly');
  END IF;

  -- Target must be active member
  SELECT * INTO v_target_member FROM room_members WHERE room_id = p_room_id AND user_id = p_target_user_id AND status = 'active';
  IF v_target_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target member not found or is not active');
  END IF;

  -- Mentors cannot have permissions modified through this function
  IF v_target_member.role = 'mentor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mentor permissions cannot be configured');
  END IF;

  -- Update permissions
  UPDATE room_members
  SET can_edit_tasks = p_can_edit_tasks,
      can_set_deadlines = p_can_set_deadlines,
      can_invite_mentors = p_can_invite_mentors,
      updated_at = NOW()
  WHERE room_id = p_room_id AND user_id = p_target_user_id;

  -- Log event
  INSERT INTO room_events (room_id, actor_id, event_type, metadata)
  VALUES (
    p_room_id,
    p_lead_id,
    'permissions_updated',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'can_edit_tasks', p_can_edit_tasks,
      'can_set_deadlines', p_can_set_deadlines,
      'can_invite_mentors', p_can_invite_mentors
    )
  );

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    p_lead_id,
    'room.permissions_updated',
    p_room_id::text,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'can_edit_tasks', p_can_edit_tasks,
      'can_set_deadlines', p_can_set_deadlines,
      'can_invite_mentors', p_can_invite_mentors
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
