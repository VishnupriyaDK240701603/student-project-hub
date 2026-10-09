-- ==============================================================================
-- FIX AUTH PERMISSIONS & AUTOMATIC PROFILE CREATION TRIGGER
-- Run this in your Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Grant full schema permissions to internal Supabase auth roles
GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, authenticator;

-- 2. Automatic trigger: creates student profile immediately when Google OAuth creates a user in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_dept TEXT;
  v_year INT;
  v_kind user_kind_enum;
  v_parts TEXT[];
BEGIN
  v_email := LOWER(NEW.email);
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(v_email, '@', 1));
  v_parts := STRING_TO_ARRAY(SPLIT_PART(v_email, '@', 1), '.');

  -- Determine student vs staff
  IF ARRAY_LENGTH(v_parts, 1) = 1 AND v_email NOT LIKE '%2%' THEN
    v_kind := 'staff';
    v_year := NULL;
    v_dept := 'FACULTY';
  ELSE
    v_kind := 'student';
    v_year := 2023;
    v_dept := UPPER(COALESCE(v_parts[ARRAY_LENGTH(v_parts, 1)], 'CSE'));
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    kind,
    admission_year,
    department,
    gender,
    consent_version,
    consent_given_at
  )
  VALUES (
    NEW.id,
    v_email,
    v_name,
    v_kind,
    v_year,
    v_dept,
    'prefer_not_to_say',
    'v1.0',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    kind = EXCLUDED.kind,
    admission_year = EXCLUDED.admission_year,
    department = EXCLUDED.department,
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync all existing auth.users into public.profiles with student role
INSERT INTO public.profiles (
  id,
  email,
  display_name,
  kind,
  admission_year,
  department,
  gender,
  consent_version,
  consent_given_at
)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)),
  'student'::user_kind_enum,
  2023,
  'CSE',
  'prefer_not_to_say'::gender_enum,
  'v1.0',
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET 
  kind = 'student',
  admission_year = 2023;

-- 4. View profiles to verify
SELECT id, email, display_name, kind, admission_year, department FROM public.profiles;
