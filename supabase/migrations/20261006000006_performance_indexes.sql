-- 20261006000006_performance_indexes.sql
-- Migration for Prompt 21: Database Query Performance & Key Foreign Key Indexing

-- 1. Messages Indexes (Optimized for real-time room chat pagination)
CREATE INDEX IF NOT EXISTS idx_messages_room_created 
  ON messages (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender 
  ON messages (sender_id);

-- 2. Room Members Indexes (Optimized for active membership checks & user room listing)
CREATE INDEX IF NOT EXISTS idx_room_members_user_status 
  ON room_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_room_members_room_status 
  ON room_members (room_id, status);

-- 3. Tasks & Milestones Indexes (Optimized for Kanban board & progress calculation)
CREATE INDEX IF NOT EXISTS idx_tasks_room_status 
  ON tasks (room_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_parent_id 
  ON tasks (parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_room_due 
  ON milestones (room_id, due_date);

-- 4. Team Requests & Applications Indexes (Optimized for open requests feed)
CREATE INDEX IF NOT EXISTS idx_team_requests_status_created 
  ON team_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_request_status 
  ON applications (request_id, status);

CREATE INDEX IF NOT EXISTS idx_applications_applicant 
  ON applications (applicant_id);

-- 5. Notifications & Mentor Invites Indexes (Optimized for user inbox badge queries)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mentor_invites_staff_status 
  ON mentor_invites (staff_id, status);

-- 6. Moderation & Audit Log Indexes
CREATE INDEX IF NOT EXISTS idx_reports_status_created 
  ON reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created 
  ON audit_log (created_at DESC);
