-- ==============================================================================
-- FIX TEAM_REQUESTS DEPARTMENT NOT-NULL CONSTRAINT & SCHEMA
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Drop NOT NULL constraint on old prototype department column
ALTER TABLE public.team_requests ALTER COLUMN department DROP NOT NULL;
ALTER TABLE public.team_requests ALTER COLUMN department SET DEFAULT 'CSE';

-- 2. Ensure all spec filter columns exist with default empty arrays
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_years INT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_departments TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_genders gender_enum[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS resume_required BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
