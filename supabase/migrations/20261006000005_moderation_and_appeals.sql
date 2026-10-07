-- 20261006000005_moderation_and_appeals.sql
-- Migration for Prompt 17: Moderation, appeals, justifications, and owner console

-- 1. Justifications RLS Policies
CREATE POLICY justifications_select ON justifications
  FOR SELECT USING (
    accused_id = auth.uid() OR
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator')
  );

CREATE POLICY justifications_insert_mod ON justifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator')
  );

CREATE POLICY justifications_update_accused ON justifications
  FOR UPDATE USING (
    accused_id = auth.uid() AND deadline > NOW()
  );

-- 2. Appeals RLS Policies
CREATE POLICY appeals_select ON appeals
  FOR SELECT USING (
    appellant_id = auth.uid() OR
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator')
  );

CREATE POLICY appeals_insert_appellant ON appeals
  FOR INSERT WITH CHECK (
    appellant_id = auth.uid()
  );

CREATE POLICY appeals_update_mod ON appeals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator')
  );

-- 3. Stored Functions for Moderation & Appeals Flow

-- Create Report with Snapshot (Rate limited to 5 per day)
CREATE OR REPLACE FUNCTION create_report_with_snapshot(
  p_target_type TEXT,
  p_target_id UUID,
  p_reason TEXT,
  p_snapshot_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_report_id UUID;
  v_today_reports_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to report.';
  END IF;

  -- Enforce 5 reports per user per day limit
  SELECT COUNT(*) INTO v_today_reports_count
  FROM reports
  WHERE reporter_id = v_user_id
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_today_reports_count >= 5 THEN
    RAISE EXCEPTION 'Report limit reached (maximum 5 reports per day).';
  END IF;

  -- Insert report
  INSERT INTO reports (
    reporter_id,
    target_type,
    target_id,
    reason,
    status
  ) VALUES (
    v_user_id,
    p_target_type,
    p_target_id,
    p_reason,
    'pending'
  ) RETURNING id INTO v_report_id;

  -- Insert snapshot data (immutable capture)
  INSERT INTO report_snapshots (
    report_id,
    snapshot_data
  ) VALUES (
    v_report_id,
    p_snapshot_data
  );

  -- Audit log (IDs only)
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    v_user_id,
    'report_created',
    'report:' || v_report_id::text,
    jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id)
  );

  RETURN v_report_id;
END;
$$;

-- Request Justification from Accused
CREATE OR REPLACE FUNCTION request_report_justification(
  p_report_id UUID,
  p_accused_id UUID,
  p_deadline_hours INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod_id UUID;
  v_justification_id UUID;
  v_deadline TIMESTAMPTZ;
BEGIN
  v_mod_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM app_roles WHERE user_id = v_mod_id AND role = 'moderator') THEN
    RAISE EXCEPTION 'Unauthorized: Only moderators can request justification.';
  END IF;

  IF p_deadline_hours < 24 OR p_deadline_hours > 168 THEN
    RAISE EXCEPTION 'Deadline must be between 24 and 168 hours.';
  END IF;

  v_deadline := NOW() + (p_deadline_hours || ' hours')::INTERVAL;

  -- Update report status & assign moderator
  UPDATE reports
  SET status = 'under_review',
      assigned_moderator_id = v_mod_id,
      updated_at = NOW()
  WHERE id = p_report_id;

  -- Insert justification request
  INSERT INTO justifications (
    report_id,
    accused_id,
    deadline
  ) VALUES (
    p_report_id,
    p_accused_id,
    v_deadline
  ) RETURNING id INTO v_justification_id;

  -- Notify accused in inbox
  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    action_url
  ) VALUES (
    p_accused_id,
    'system_announcement',
    'Action Required: Response requested regarding a report',
    'A moderator has requested a response to a reported item. Please submit your justification before the deadline.',
    '/blocked'
  );

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    v_mod_id,
    'justification_requested',
    'report:' || p_report_id::text,
    jsonb_build_object('accused_id', p_accused_id, 'deadline_hours', p_deadline_hours)
  );

  RETURN v_justification_id;
END;
$$;

-- Submit Justification by Accused
CREATE OR REPLACE FUNCTION submit_report_justification(
  p_justification_id UUID,
  p_content TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_deadline TIMESTAMPTZ;
  v_report_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT deadline, report_id INTO v_deadline, v_report_id
  FROM justifications
  WHERE id = p_justification_id AND accused_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Justification request not found or unauthorized.';
  END IF;

  IF NOW() > v_deadline THEN
    RAISE EXCEPTION 'The deadline to submit a justification has passed.';
  END IF;

  UPDATE justifications
  SET content = p_content
  WHERE id = p_justification_id;

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    v_user_id,
    'justification_submitted',
    'justification:' || p_justification_id::text,
    jsonb_build_object('report_id', v_report_id)
  );
END;
$$;

-- Permanently Block User
CREATE OR REPLACE FUNCTION block_user_from_report(
  p_report_id UUID,
  p_accused_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod_id UUID;
BEGIN
  v_mod_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM app_roles WHERE user_id = v_mod_id AND role = 'moderator') THEN
    RAISE EXCEPTION 'Unauthorized: Only moderators can block users.';
  END IF;

  -- Update accused profile
  UPDATE profiles
  SET is_blocked = true,
      updated_at = NOW()
  WHERE id = p_accused_id;

  -- Update report status
  UPDATE reports
  SET status = 'actioned',
      assigned_moderator_id = v_mod_id,
      updated_at = NOW()
  WHERE id = p_report_id;

  -- Audit log (IDs only)
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    v_mod_id,
    'user_blocked',
    'profile:' || p_accused_id::text,
    jsonb_build_object('report_id', p_report_id)
  );
END;
$$;

-- Submit Appeal (Blocked User)
CREATE OR REPLACE FUNCTION submit_moderation_appeal(
  p_report_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_appeal_id UUID;
  v_existing_appeal_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Check if already appealed for this report
  SELECT COUNT(*) INTO v_existing_appeal_count
  FROM appeals
  WHERE report_id = p_report_id AND appellant_id = v_user_id;

  IF v_existing_appeal_count > 0 THEN
    RAISE EXCEPTION 'An appeal has already been submitted for this report.';
  END IF;

  INSERT INTO appeals (
    report_id,
    appellant_id,
    reason,
    status
  ) VALUES (
    p_report_id,
    v_user_id,
    p_reason,
    'appealed'
  ) RETURNING id INTO v_appeal_id;

  UPDATE reports
  SET status = 'appealed',
      updated_at = NOW()
  WHERE id = p_report_id;

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    v_user_id,
    'appeal_submitted',
    'appeal:' || v_appeal_id::text,
    jsonb_build_object('report_id', p_report_id)
  );

  RETURN v_appeal_id;
END;
$$;

-- Resolve Appeal (Two-Moderator Rule: decider != blocker/assignee)
CREATE OR REPLACE FUNCTION resolve_moderation_appeal(
  p_appeal_id UUID,
  p_decision TEXT, -- 'approved' or 'rejected'
  p_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deciding_mod_id UUID;
  v_blocking_mod_id UUID;
  v_appellant_id UUID;
  v_report_id UUID;
BEGIN
  v_deciding_mod_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM app_roles WHERE user_id = v_deciding_mod_id AND role = 'moderator') THEN
    RAISE EXCEPTION 'Unauthorized: Only moderators can resolve appeals.';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected.';
  END IF;

  -- Fetch appeal and associated report
  SELECT a.appellant_id, a.report_id, r.assigned_moderator_id
  INTO v_appellant_id, v_report_id, v_blocking_mod_id
  FROM appeals a
  JOIN reports r ON r.id = a.report_id
  WHERE a.id = p_appeal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appeal not found.';
  END IF;

  -- TWO-MODERATOR RULE: The deciding moderator MUST be different from the moderator who actioned/blocked
  IF v_blocking_mod_id IS NOT NULL AND v_deciding_mod_id = v_blocking_mod_id THEN
    RAISE EXCEPTION 'Two-moderator rule: An appeal cannot be decided by the moderator who originally actioned the report.';
  END IF;

  IF p_decision = 'approved' THEN
    -- Unblock appellant
    UPDATE profiles
    SET is_blocked = false,
        updated_at = NOW()
    WHERE id = v_appellant_id;

    UPDATE appeals
    SET status = 'dismissed'
    WHERE id = p_appeal_id;

    UPDATE reports
    SET status = 'dismissed',
        updated_at = NOW()
    WHERE id = v_report_id;
  ELSE
    UPDATE appeals
    SET status = 'actioned'
    WHERE id = p_appeal_id;

    UPDATE reports
    SET status = 'actioned',
        updated_at = NOW()
    WHERE id = v_report_id;
  END IF;

  -- Audit log
  INSERT INTO audit_log (actor_id, action, target, metadata)
  VALUES (
    v_deciding_mod_id,
    'appeal_resolved',
    'appeal:' || p_appeal_id::text,
    jsonb_build_object(
      'decision', p_decision,
      'appellant_id', v_appellant_id,
      'blocking_mod_id', v_blocking_mod_id
    )
  );
END;
$$;
