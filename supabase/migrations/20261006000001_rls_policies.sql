-- PostgreSQL Migration for Row-Level Security (RLS) Policies
-- Spec Version 1 (Prompt 4)

-- 1. Security-Definer Helper Functions (with explicit search_path pinning)

-- Helper: Check if user is request lead
CREATE OR REPLACE FUNCTION is_request_lead(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_requests WHERE id = p_request_id AND lead_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Helper: Check if user can view a team request based on student eligibility filters & staff exclusion
CREATE OR REPLACE FUNCTION can_view_request(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_kind user_kind_enum;
  v_user_year INT;
  v_user_dept TEXT;
  v_user_gender gender_enum;
  v_req RECORD;
BEGIN
  SELECT kind, admission_year, department, gender
  INTO v_user_kind, v_user_year, v_user_dept, v_user_gender
  FROM profiles WHERE id = p_user_id;

  IF v_user_kind IS NULL OR v_user_kind = 'staff' THEN
    RETURN FALSE; -- Staff accounts CANNOT browse the requests feed
  END IF;

  SELECT * INTO v_req FROM team_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Year Filter Check
  IF array_length(v_req.filter_years, 1) > 0 THEN
    IF NOT (v_user_year = ANY(v_req.filter_years)) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Department Filter Check
  IF array_length(v_req.filter_departments, 1) > 0 THEN
    IF NOT (v_user_dept = ANY(v_req.filter_departments)) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Gender Filter Check
  IF array_length(v_req.filter_genders, 1) > 0 THEN
    -- 'other' and 'prefer_not_to_say' do NOT match requests with specific gender filters
    IF v_user_gender IN ('other', 'prefer_not_to_say') OR NOT (v_user_gender = ANY(v_req.filter_genders)) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Helper: Check if user is an active member or lead in room
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql;

-- Helper: Check if user is an active mentor in room
CREATE OR REPLACE FUNCTION is_active_mentor(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND role = 'mentor'
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql;


-- 2. Table RLS Policies

-- Profiles Policies
CREATE POLICY profiles_select_self_or_public ON profiles
  FOR SELECT USING (auth.uid() = id OR is_deactivated = FALSE);

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- App Roles Policies (STRICT READ ONLY FOR OWNER, USER INSERT/UPDATE DENIED)
CREATE POLICY app_roles_select_owner ON app_roles
  FOR SELECT USING (EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- Team Requests Policies
CREATE POLICY team_requests_select_eligible ON team_requests
  FOR SELECT USING (can_view_request(id, auth.uid()) OR lead_id = auth.uid());

CREATE POLICY team_requests_insert_lead ON team_requests
  FOR INSERT WITH CHECK (
    auth.uid() = lead_id AND
    (SELECT kind FROM profiles WHERE id = auth.uid()) = 'student' AND
    (SELECT COUNT(*) FROM team_requests WHERE lead_id = auth.uid() AND status = 'open') < 3
  );

CREATE POLICY team_requests_update_lead ON team_requests
  FOR UPDATE USING (auth.uid() = lead_id);

-- Applications Policies
CREATE POLICY applications_select_applicant_or_lead ON applications
  FOR SELECT USING (
    applicant_id = auth.uid() OR
    is_request_lead(request_id, auth.uid())
  );

CREATE POLICY applications_insert_applicant ON applications
  FOR INSERT WITH CHECK (
    applicant_id = auth.uid() AND
    can_view_request(request_id, auth.uid()) AND
    NOT is_request_lead(request_id, auth.uid())
  );

CREATE POLICY applications_update_applicant_or_lead ON applications
  FOR UPDATE USING (
    applicant_id = auth.uid() OR
    is_request_lead(request_id, auth.uid())
  );

-- Application Files Policies
CREATE POLICY application_files_select_applicant_or_lead ON application_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id AND (
        a.applicant_id = auth.uid() OR
        is_request_lead(a.request_id, auth.uid())
      )
    )
  );

CREATE POLICY application_files_insert_applicant ON application_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

-- Rooms Policies (Members & Mentors ONLY - Moderators & Owner DENIED)
CREATE POLICY rooms_select_members ON rooms
  FOR SELECT USING (is_room_member(id, auth.uid()) OR is_active_mentor(id, auth.uid()));

-- Room Members Policies
CREATE POLICY room_members_select_members ON room_members
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

-- Messages Policies (Members & Mentors ONLY - Moderators & Owner DENIED)
CREATE POLICY messages_select_members ON messages
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

CREATE POLICY messages_insert_members ON messages
  FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND sender_id = auth.uid());

CREATE POLICY messages_update_own ON messages
  FOR UPDATE USING (sender_id = auth.uid() AND is_room_member(room_id, auth.uid()));

-- Tasks Policies
CREATE POLICY tasks_select_members ON tasks
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

CREATE POLICY tasks_insert_members ON tasks
  FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()));

CREATE POLICY tasks_update_members ON tasks
  FOR UPDATE USING (is_room_member(room_id, auth.uid()));

-- Room Files Policies
CREATE POLICY room_files_select_members ON room_files
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

CREATE POLICY room_files_insert_members ON room_files
  FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND uploader_id = auth.uid());

-- Notifications Policies
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_insert_auth ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Push Subscriptions Policies
CREATE POLICY push_subscriptions_select_own ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert_own ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_own ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Reports Policies (Reporter or Assigned Moderator ONLY)
CREATE POLICY reports_select_reporter_or_mod ON reports
  FOR SELECT USING (
    reporter_id = auth.uid() OR
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator')
  );

CREATE POLICY reports_insert_auth ON reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Report Snapshots Policies
CREATE POLICY report_snapshots_select_mod ON report_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator')
  );

-- Audit Log Policies (INSERT ONLY for users - UPDATE & DELETE DENIED)
CREATE POLICY audit_log_insert_auth ON audit_log
  FOR INSERT WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE POLICY audit_log_select_owner ON audit_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'owner'));
