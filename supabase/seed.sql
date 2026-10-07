-- Local Development Seed Data (SYNTHETIC ONLY)
-- Populates auth.users and public.profiles with sample local accounts

-- 1. Insert Synthetic Auth Users
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'lead.student.22.cse@rajlakshmi.edu.in',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Lead Student"}',
    false
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'applicant.student.22.cse@rajlakshmi.edu.in',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Applicant Student"}',
    false
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'mentor.staff.cse@rajlakshmi.edu.in',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Staff Mentor"}',
    false
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'moderator.staff.cse@rajlakshmi.edu.in',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Staff Moderator"}',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Synthetic Seed Profiles
-- Lead Student
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

-- Applicant Student
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

-- Staff Mentor
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

-- Staff Moderator
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

-- Assign Moderator Role
INSERT INTO app_roles (user_id, role)
VALUES ('44444444-4444-4444-4444-444444444444', 'moderator')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Synthetic Sample Team Request
INSERT INTO team_requests (id, lead_id, title, description, status, role_needed, headcount, department, required_skills)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  'AI Powered Campus Navigation App',
  'Building an AR/AI mobile app for campus navigation.',
  'open',
  'Frontend Developer',
  2,
  'CSE',
  ARRAY['Next.js', 'AI', 'PWA']
) ON CONFLICT (id) DO NOTHING;
