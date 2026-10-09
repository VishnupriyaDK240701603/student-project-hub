-- ==============================================================================
-- FIX RLS FOR APPLICATION_FILES, ROOMS & ROOM_MEMBERS
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Enable RLS and add full policies for application_files
ALTER TABLE public.application_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_files_select ON public.application_files;
DROP POLICY IF EXISTS application_files_insert ON public.application_files;
DROP POLICY IF EXISTS application_files_update ON public.application_files;
DROP POLICY IF EXISTS application_files_delete ON public.application_files;

-- Allow applicants and request leads to view application files (resumes)
CREATE POLICY application_files_select ON public.application_files 
FOR SELECT 
USING (
  uploader_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE a.id = application_files.application_id
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

-- Allow authenticated students to upload/insert their application file metadata
CREATE POLICY application_files_insert ON public.application_files 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND auth.uid() = uploader_id
);

-- Allow file owner to update
CREATE POLICY application_files_update ON public.application_files 
FOR UPDATE 
USING (
  uploader_id = auth.uid()
);

-- Allow applicant or lead to delete (e.g. on withdrawal or retention cleanup)
CREATE POLICY application_files_delete ON public.application_files 
FOR DELETE 
USING (
  uploader_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE a.id = application_files.application_id
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

-- 2. Fix Rooms RLS Policies (Allow lead, members, and mentors to access room)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rooms_select_members ON public.rooms;
DROP POLICY IF EXISTS rooms_insert_auth ON public.rooms;
DROP POLICY IF EXISTS rooms_update_lead ON public.rooms;

CREATE POLICY rooms_select_members ON public.rooms 
FOR SELECT 
USING (
  lead_id = auth.uid() 
  OR is_room_member(id, auth.uid()) 
  OR is_active_mentor(id, auth.uid())
);

CREATE POLICY rooms_insert_auth ON public.rooms 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY rooms_update_lead ON public.rooms 
FOR UPDATE 
USING (lead_id = auth.uid());

-- 3. Fix Room Members RLS Policies
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_members_select ON public.room_members;
DROP POLICY IF EXISTS room_members_insert ON public.room_members;
DROP POLICY IF EXISTS room_members_update ON public.room_members;

CREATE POLICY room_members_select ON public.room_members 
FOR SELECT 
USING (
  user_id = auth.uid()
  OR is_room_member(room_id, auth.uid()) 
  OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.lead_id = auth.uid())
  OR is_active_mentor(room_id, auth.uid())
);

CREATE POLICY room_members_insert ON public.room_members 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY room_members_update ON public.room_members 
FOR UPDATE 
USING (
  user_id = auth.uid()
  OR is_room_member(room_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_members.room_id AND r.lead_id = auth.uid())
);

-- 4. Backfill any existing requests into rooms & members
DO $$
DECLARE
  r RECORD;
  v_room_id UUID;
  v_app RECORD;
BEGIN
  FOR r IN SELECT id, lead_id, title, status FROM public.team_requests WHERE status IN ('open', 'closed', 'full') LOOP
    SELECT id INTO v_room_id FROM public.rooms WHERE initial_request_id = r.id;

    IF v_room_id IS NULL THEN
      INSERT INTO public.rooms (name, initial_request_id, lead_id)
      VALUES (COALESCE(r.title, 'Project Team Room'), r.id, r.lead_id)
      RETURNING id INTO v_room_id;

      UPDATE public.team_requests SET room_id = v_room_id WHERE id = r.id;
    END IF;

    -- Add lead to room_members
    INSERT INTO public.room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
    VALUES (v_room_id, r.lead_id, 'lead', 'active', true, true, true)
    ON CONFLICT (room_id, user_id) DO UPDATE
    SET status = 'active', role = 'lead';

    -- Add all accepted/selected applicants
    FOR v_app IN SELECT applicant_id FROM public.applications WHERE request_id = r.id AND status IN ('accepted', 'selected') LOOP
      INSERT INTO public.room_members (room_id, user_id, role, status)
      VALUES (v_room_id, v_app.applicant_id, 'member', 'active')
      ON CONFLICT (room_id, user_id) DO UPDATE
      SET status = 'active';
    END LOOP;
  END LOOP;
END;
$$;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
