-- ==============================================================================
-- FIX TEAM_REQUESTS RLS POLICIES
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

ALTER TABLE public.team_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requests_select_allowed ON public.team_requests;
DROP POLICY IF EXISTS requests_insert_auth ON public.team_requests;
DROP POLICY IF EXISTS requests_update_lead ON public.team_requests;
DROP POLICY IF EXISTS requests_all_authenticated ON public.team_requests;

-- 1. Allow authenticated users to view team requests
CREATE POLICY requests_select_allowed ON public.team_requests 
FOR SELECT 
USING (
  status = 'open' 
  OR lead_id = auth.uid() 
  OR auth.uid() IS NOT NULL
);

-- 2. Allow logged-in users to create a request for themselves
CREATE POLICY requests_insert_auth ON public.team_requests 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid() = lead_id
);

-- 3. Allow lead to update their own request
CREATE POLICY requests_update_lead ON public.team_requests 
FOR UPDATE 
USING (lead_id = auth.uid());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
