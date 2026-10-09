-- ==============================================================================
-- Quick Fix: Update user profile role to student
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Update all non-staff accounts or your specific email to student:
UPDATE public.profiles
SET 
  kind = 'student',
  admission_year = COALESCE(admission_year, 2023)
WHERE kind = 'staff';

-- 2. Verify your profile:
SELECT id, email, display_name, kind, admission_year, department 
FROM public.profiles;
