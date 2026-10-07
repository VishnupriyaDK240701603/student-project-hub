-- PostgreSQL Schema Migration for Student Project Hub
-- Spec Version 1 (Prompt 3)

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
  consent_version TEXT NOT NULL DEFAULT 'v1',
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
  tags TEXT[] NOT NULL DEFAULT '{}',
  filter_years INT[] NOT NULL DEFAULT '{}',
  filter_departments TEXT[] NOT NULL DEFAULT '{}',
  filter_genders gender_enum[] NOT NULL DEFAULT '{}',
  resume_required BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES team_requests(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note TEXT,
  status application_status_enum NOT NULL DEFAULT 'applied',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, applicant_id)
);

-- Application Files (Resumes / Docs)
CREATE TABLE application_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes <= 10485760), -- 10 MB limit
  delete_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES team_requests(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  removed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Room Events
CREATE TABLE room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mentor Invites
CREATE TABLE mentor_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES team_requests(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status application_status_enum NOT NULL DEFAULT 'selected',
  expires_at TIMESTAMPTZ NOT NULL,
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

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reactions
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Mentions
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Room Files
CREATE TABLE room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes <= 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  target_type TEXT NOT NULL, -- 'user' or 'request' or 'message'
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status report_status_enum NOT NULL DEFAULT 'pending',
  assigned_moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report Snapshots
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

-- Audit Log (Insert-only)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Usage
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

-- 3. Row-Level Security Enforcements (Deny All by default)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- 4. Constraints & Triggers

-- Single-Level Subtask Trigger
CREATE OR REPLACE FUNCTION check_single_level_subtask()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF (SELECT parent_id FROM tasks WHERE id = NEW.parent_id) IS NOT NULL THEN
      RAISE EXCEPTION 'Subtasks cannot have subtasks (one level only)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_level_subtask
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION check_single_level_subtask();

-- Prevent Audit Log Mutability Trigger
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_audit_log_immutability
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_mutation();

-- 5. Atomic SQL Helper Functions

-- Create Room Function (Idempotent)
CREATE OR REPLACE FUNCTION create_room_if_ready(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_lead_id UUID;
  v_app RECORD;
BEGIN
  SELECT lead_id INTO v_lead_id FROM team_requests WHERE id = p_request_id;
  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT id INTO v_room_id FROM rooms WHERE request_id = p_request_id;
  
  IF v_room_id IS NULL THEN
    INSERT INTO rooms (request_id, lead_id)
    VALUES (p_request_id, v_lead_id)
    RETURNING id INTO v_room_id;

    -- Add Lead as Lead Member with full permissions
    INSERT INTO room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
    VALUES (v_room_id, v_lead_id, 'lead', 'active', TRUE, TRUE, TRUE)
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;

  -- Add all currently accepted applicants
  FOR v_app IN SELECT applicant_id FROM applications WHERE request_id = p_request_id AND status = 'accepted' LOOP
    INSERT INTO room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
    VALUES (v_room_id, v_app.applicant_id, 'member', 'active', FALSE, FALSE, FALSE)
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic Accept Invite Function with Row Locking
CREATE OR REPLACE FUNCTION accept_invite(p_application_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_app RECORD;
  v_req RECORD;
  v_accepted_count INT;
  v_room_id UUID;
BEGIN
  -- Select Application and lock team request row
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

  -- Check if team reached headcount or is closed
  IF v_accepted_count >= v_req.headcount THEN
    UPDATE team_requests SET status = 'full', updated_at = NOW() WHERE id = v_req.id;
    v_room_id := create_room_if_ready(v_req.id);
  ELSIF v_req.status = 'closed' THEN
    v_room_id := create_room_if_ready(v_req.id);
  END IF;

  RETURN jsonb_build_object('success', true, 'room_id', v_room_id);
END;
$$ LANGUAGE plpgsql;

-- Headcount Raise Function (Raise only)
CREATE OR REPLACE FUNCTION raise_headcount(p_request_id UUID, p_new_headcount INT)
RETURNS VOID AS $$
DECLARE
  v_current_headcount INT;
BEGIN
  SELECT headcount INTO v_current_headcount FROM team_requests WHERE id = p_request_id;
  IF v_current_headcount IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF p_new_headcount <= v_current_headcount THEN
    RAISE EXCEPTION 'Headcount can only be raised, not reduced';
  END IF;

  UPDATE team_requests
  SET headcount = p_new_headcount,
      status = CASE WHEN status = 'full' THEN 'open' ELSE status END,
      updated_at = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Close Request Function
CREATE OR REPLACE FUNCTION close_request(p_request_id UUID, p_lead_id UUID)
RETURNS VOID AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM team_requests WHERE id = p_request_id AND lead_id = p_lead_id;
  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Request not found or user is not lead';
  END IF;

  UPDATE team_requests SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = p_request_id;
  PERFORM create_room_if_ready(p_request_id);
END;
$$ LANGUAGE plpgsql;

-- 6. Indexes Performance Optimization
CREATE INDEX idx_team_requests_status_created ON team_requests(status, created_at DESC);
CREATE INDEX idx_applications_request_status ON applications(request_id, status);
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC);
CREATE INDEX idx_tasks_room_status ON tasks(room_id, status);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
