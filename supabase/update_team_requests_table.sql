-- ==============================================================================
-- ADD MISSING COLUMNS TO TEAM_REQUESTS TABLE
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_years INT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_departments TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_genders gender_enum[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS resume_required BOOLEAN NOT NULL DEFAULT FALSE;

-- Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
