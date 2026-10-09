-- ==============================================================================
-- ADD MISSING 'expires_at' COLUMN TO APPLICATIONS TABLE
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Add expires_at column if not exists
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
