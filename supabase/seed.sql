-- Local Development Seed Data (SYNTHETIC ONLY)
-- Refuses execution if APP_ENV is not 'local'

DO $$
BEGIN
  IF COALESCE(current_setting('app.environment', true), 'local') != 'local' THEN
    RAISE EXCEPTION 'Seed script execution strictly prohibited in non-local environments!';
  END IF;
END $$;

-- Synthetic Seed Profiles
-- 1. Student Lead
INSERT INTO profiles (id, email, display_name, kind, admission_year, department, gender)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'lead.student.22.cse@rajlakshmi.edu.in',
  'Lead Student',
  'student',
  2022,
  'CSE',
  'female'
) ON CONFLICT (id) DO NOTHING;

-- 2. Student Applicant
INSERT INTO profiles (id, email, display_name, kind, admission_year, department, gender)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'applicant.student.22.cse@rajlakshmi.edu.in',
  'Applicant Student',
  'student',
  2022,
  'CSE',
  'male'
) ON CONFLICT (id) DO NOTHING;

-- 3. Staff Mentor
INSERT INTO profiles (id, email, display_name, kind, admission_year, department, gender)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'mentor.staff.cse@rajlakshmi.edu.in',
  'Staff Mentor',
  'staff',
  NULL,
  'CSE',
  'prefer_not_to_say'
) ON CONFLICT (id) DO NOTHING;

-- 4. Moderator
INSERT INTO profiles (id, email, display_name, kind, admission_year, department, gender)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'moderator.staff.cse@rajlakshmi.edu.in',
  'Staff Moderator',
  'staff',
  NULL,
  'CSE',
  'prefer_not_to_say'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO app_roles (user_id, role)
VALUES ('44444444-4444-4444-4444-444444444444', 'moderator')
ON CONFLICT (user_id, role) DO NOTHING;

-- Synthetic Sample Team Request
INSERT INTO team_requests (id, lead_id, title, description, status, role_needed, headcount, tags)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  'AI Powered Campus Navigation App',
  'Building an AR/AI mobile app for campus navigation.',
  'open',
  'Frontend Developer',
  2,
  ARRAY['Next.js', 'AI', 'PWA']
) ON CONFLICT (id) DO NOTHING;
