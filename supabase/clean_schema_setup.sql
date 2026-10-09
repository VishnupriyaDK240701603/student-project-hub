-- ====================================================================
-- STUDENT PROJECT HUB: COMPLETE CLEAN DATABASE SETUP
-- ====================================================================
-- Resets the public schema cleanly and creates all tables, types,
-- RLS policies, triggers, functions, and performance indexes.
-- ====================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
GRANT ALL ON SCHEMA public TO public;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- 1. Custom Enum Types
CREATE TYPE user_kind_enum AS ENUM ('student', 'staff');
CREATE TYPE gender_enum AS ENUM ('female', 'male', 'other', 'prefer_not_to_say');
CREATE TYPE app_role_enum AS ENUM ('owner', 'moderator');
CREATE TYPE request_status_enum AS ENUM ('open', 'closed', 'full');
CREATE TYPE application_status_enum AS ENUM (
  'applied',
  'selected',
  'waitlisted',
  'rejected',
  'accepted',
  'declined',
  'expired',
  'withdrawn'
);
CREATE TYPE room_member_role_enum AS ENUM ('lead', 'member', 'mentor');
CREATE TYPE room_member_status_enum AS ENUM ('active', 'left', 'removed');
CREATE TYPE task_status_enum AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE report_status_enum AS ENUM ('pending', 'under_review', 'dismissed', 'blocked', 'appealed');

-- 2. Core Tables Definition

-- Profiles (derived from auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  kind user_kind_enum NOT NULL,
  admission_year INT,
  department TEXT NOT NULL,
  gender gender_enum NOT NULL DEFAULT 'prefer_not_to_say',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  is_deactivated BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version TEXT NOT NULL DEFAULT 'v1.0',
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App Roles (Owner / Moderator)
CREATE TABLE app_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Team Requests
CREATE TABLE team_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status request_status_enum NOT NULL DEFAULT 'open',
  role_needed TEXT NOT NULL,
  headcount INT NOT NULL CHECK (headcount > 0),
  department TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  filter_years INT[] NOT NULL DEFAULT '{}',
  filter_departments TEXT[] NOT NULL DEFAULT '{}',
  filter_genders gender_enum[] NOT NULL DEFAULT '{}',
  resume_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_capacity INT NOT NULL DEFAULT 1,
  max_capacity INT NOT NULL DEFAULT 6,
  room_id UUID,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initial_request_id UUID REFERENCES team_requests(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE team_requests ADD CONSTRAINT fk_team_requests_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

-- Room Members
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role room_member_role_enum NOT NULL DEFAULT 'member',
  status room_member_status_enum NOT NULL DEFAULT 'active',
  can_edit_tasks BOOLEAN NOT NULL DEFAULT FALSE,
  can_set_deadlines BOOLEAN NOT NULL DEFAULT FALSE,
  can_invite_mentors BOOLEAN NOT NULL DEFAULT FALSE,
  can_readd_members BOOLEAN NOT NULL DEFAULT FALSE,
  removed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Room Events (Activity feed per room)
CREATE TABLE room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES team_requests(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status application_status_enum NOT NULL DEFAULT 'applied',
  note TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, applicant_id)
);

-- Application Files (Resumes / Portfolios with 30-day retention)
CREATE TABLE application_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  mime_type TEXT NOT NULL,
  delete_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lead Transfers
CREATE TABLE lead_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  current_lead_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_lead_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status application_status_enum NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mentor Invites
CREATE TABLE mentor_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES team_requests(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status application_status_enum NOT NULL DEFAULT 'applied',
  expires_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Message Reactions
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Message Mentions
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, mentioned_user_id)
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status_enum NOT NULL DEFAULT 'todo',
  due_date TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task Assignees
CREATE TABLE task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- Task Comments
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task Attachments
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_link TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Room Files
CREATE TABLE room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Push Subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status report_status_enum NOT NULL DEFAULT 'pending',
  assigned_moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report Snapshots (Immutable Evidence)
CREATE TABLE report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Justifications
CREATE TABLE justifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  accused_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Appeals
CREATE TABLE appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  appellant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status report_status_enum NOT NULL DEFAULT 'appealed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Log (Immutable, Insert-only)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Usage Tracker
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

-- 3. Row-Level Security Enablement
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- 4. Triggers & Constraints

-- Single Level Subtask Constraint
CREATE OR REPLACE FUNCTION check_single_level_subtask()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM tasks WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Subtasks cannot have subtasks (only single-level nesting is permitted)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_level_subtask
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION check_single_level_subtask();

-- Prevent Audit Log Mutation
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_audit_log_immutability
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

-- 5. Helper Functions for RLS
CREATE OR REPLACE FUNCTION is_request_lead(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_requests WHERE id = p_request_id AND lead_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION can_view_request(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_requests tr
    WHERE tr.id = p_request_id
    AND (
      tr.status = 'open'
      OR tr.lead_id = p_user_id
      OR EXISTS (SELECT 1 FROM applications a WHERE a.request_id = tr.id AND a.applicant_id = p_user_id)
      OR EXISTS (SELECT 1 FROM mentor_invites m WHERE m.request_id = tr.id AND m.staff_id = p_user_id)
      OR EXISTS (SELECT 1 FROM app_roles r WHERE r.user_id = p_user_id AND r.role = 'owner')
    )
  );
$$;

CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_active_mentor(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id
      AND user_id = p_user_id
      AND role = 'mentor'
      AND status = 'active'
  );
$$;

-- 6. RLS Policies

-- Profiles
CREATE POLICY profiles_select_all ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_auth ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- App Roles
CREATE POLICY app_roles_select_auth ON app_roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Team Requests
CREATE POLICY requests_select_allowed ON team_requests FOR SELECT USING (can_view_request(id, auth.uid()));
CREATE POLICY requests_insert_auth ON team_requests FOR INSERT WITH CHECK (auth.uid() = lead_id);
CREATE POLICY requests_update_lead ON team_requests FOR UPDATE USING (lead_id = auth.uid());

-- Rooms & Members
CREATE POLICY rooms_select_members ON rooms FOR SELECT USING (lead_id = auth.uid() OR is_room_member(id, auth.uid()) OR is_active_mentor(id, auth.uid()));
CREATE POLICY rooms_insert_auth ON rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY rooms_update_lead ON rooms FOR UPDATE USING (lead_id = auth.uid());
CREATE POLICY room_members_select ON room_members FOR SELECT USING (user_id = auth.uid() OR is_room_member(room_id, auth.uid()) OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_members.room_id AND r.lead_id = auth.uid()) OR is_active_mentor(room_id, auth.uid()));
CREATE POLICY room_members_insert ON room_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY room_members_update ON room_members FOR UPDATE USING (user_id = auth.uid() OR is_room_member(room_id, auth.uid()) OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_members.room_id AND r.lead_id = auth.uid()));

-- Room Events
CREATE POLICY room_events_select ON room_events FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));
CREATE POLICY room_events_insert ON room_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Applications
CREATE POLICY applications_select_involved ON applications FOR SELECT USING (applicant_id = auth.uid() OR is_request_lead(request_id, auth.uid()));
CREATE POLICY applications_insert_own ON applications FOR INSERT WITH CHECK (applicant_id = auth.uid());
CREATE POLICY applications_update_involved ON applications FOR UPDATE USING (applicant_id = auth.uid() OR is_request_lead(request_id, auth.uid()));

-- Application Files (Resumes / Portfolios)
CREATE POLICY application_files_select ON application_files FOR SELECT USING (uploader_id = auth.uid() OR EXISTS (SELECT 1 FROM applications a JOIN team_requests tr ON tr.id = a.request_id WHERE a.id = application_files.application_id AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())));
CREATE POLICY application_files_insert ON application_files FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = uploader_id);
CREATE POLICY application_files_update ON application_files FOR UPDATE USING (uploader_id = auth.uid());
CREATE POLICY application_files_delete ON application_files FOR DELETE USING (uploader_id = auth.uid() OR EXISTS (SELECT 1 FROM applications a JOIN team_requests tr ON tr.id = a.request_id WHERE a.id = application_files.application_id AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())));


-- Messages
CREATE POLICY messages_select_members ON messages FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));
CREATE POLICY messages_insert_members ON messages FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND sender_id = auth.uid());
CREATE POLICY messages_update_own ON messages FOR UPDATE USING (sender_id = auth.uid());

-- Tasks
CREATE POLICY tasks_select_members ON tasks FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));
CREATE POLICY tasks_insert_members ON tasks FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()));
CREATE POLICY tasks_update_members ON tasks FOR UPDATE USING (is_room_member(room_id, auth.uid()));
CREATE POLICY tasks_delete_members ON tasks FOR DELETE USING (is_room_member(room_id, auth.uid()));

-- Milestones
CREATE POLICY milestones_select_room_members ON milestones FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));
CREATE POLICY milestones_insert_room_members ON milestones FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()));
CREATE POLICY milestones_update_room_members ON milestones FOR UPDATE USING (is_room_member(room_id, auth.uid()));
CREATE POLICY milestones_delete_room_members ON milestones FOR DELETE USING (is_room_member(room_id, auth.uid()));

-- Meetings
CREATE POLICY meetings_select_room_members ON meetings FOR SELECT USING (is_room_member(room_id, auth.uid()));
CREATE POLICY meetings_insert_room_members ON meetings FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY meetings_delete_creator_or_lead ON meetings FOR DELETE USING (
  is_room_member(room_id, auth.uid())
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = meetings.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'lead'
        AND rm.status = 'active'
    )
  )
);

-- Room Files
CREATE POLICY room_files_select_members ON room_files FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));
CREATE POLICY room_files_insert_members ON room_files FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY room_files_delete_members ON room_files FOR DELETE USING (
  is_room_member(room_id, auth.uid())
  AND (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_files.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'lead'
        AND rm.status = 'active'
    )
  )
);

-- Notifications
CREATE POLICY notifications_select_own ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_insert_auth ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY notifications_update_own ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Reports & Snapshots
CREATE POLICY reports_select ON reports FOR SELECT USING (reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator'));
CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY report_snapshots_select ON report_snapshots FOR SELECT USING (EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator'));

-- Justifications & Appeals
CREATE POLICY justifications_select ON justifications FOR SELECT USING (accused_id = auth.uid() OR EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator'));
CREATE POLICY appeals_select ON appeals FOR SELECT USING (appellant_id = auth.uid() OR EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'moderator'));
CREATE POLICY appeals_insert ON appeals FOR INSERT WITH CHECK (appellant_id = auth.uid());

-- Audit Log
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY audit_log_select_owner ON audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM app_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- 7. High-Performance Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_members_user_status ON room_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_room_members_room_status ON room_members (room_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_room_status ON tasks (room_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_requests_status_created ON team_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_request_status ON applications (request_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_events_room_created ON room_events (room_id, created_at DESC);

-- 8. Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('application-files', 'application-files', false, 10485760),
  ('resumes', 'resumes', false, 10485760),
  ('room-files', 'room-files', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = EXCLUDED.file_size_limit;

-- Storage Policies for application-files
DROP POLICY IF EXISTS "Authenticated users can upload application files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read application files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete application files" ON storage.objects;

CREATE POLICY "Authenticated users can upload application files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'application-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read application files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'application-files'
  AND EXISTS (
    SELECT 1 FROM public.application_files af
    JOIN public.applications a ON a.id = af.application_id
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE af.storage_path = storage.objects.name
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

CREATE POLICY "Users can delete application files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'application-files'
  AND EXISTS (
    SELECT 1 FROM public.application_files af
    JOIN public.applications a ON a.id = af.application_id
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE af.storage_path = storage.objects.name
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

-- Storage Policies for resumes
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can read resumes" ON storage.objects;

CREATE POLICY "Authenticated users can upload resumes" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read resumes" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'resumes'
  AND EXISTS (
    SELECT 1 FROM public.application_files af
    JOIN public.applications a ON a.id = af.application_id
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE af.storage_path = storage.objects.name
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

-- Storage Policies for room-files
DROP POLICY IF EXISTS "Authenticated users can upload room files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read room files" ON storage.objects;

CREATE POLICY "Authenticated users can upload room files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read room files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

