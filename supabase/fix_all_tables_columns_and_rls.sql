-- ==============================================================================
-- FIX ALL MISSING COLUMNS & RLS POLICIES ACROSS ALL TABLES
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Ensure all missing columns exist on 'rooms'
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure all missing columns exist on 'room_members'
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS removed_reason TEXT;
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS can_edit_tasks BOOLEAN DEFAULT FALSE;
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS can_set_deadlines BOOLEAN DEFAULT FALSE;
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS can_invite_mentors BOOLEAN DEFAULT FALSE;
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS can_readd_members BOOLEAN DEFAULT FALSE;

-- 3. Ensure all missing columns exist on 'team_requests'
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS room_id UUID;
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS resume_required BOOLEAN DEFAULT FALSE;
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_years INT[] DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS filter_departments TEXT[] DEFAULT '{}';
ALTER TABLE public.team_requests ADD COLUMN IF NOT EXISTS required_skills TEXT[] DEFAULT '{}';

-- 4. Ensure all missing columns exist on 'application_files'
ALTER TABLE public.application_files ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ;
ALTER TABLE public.application_files ADD COLUMN IF NOT EXISTS uploader_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.application_files ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.application_files ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 5. Create 'room_events' table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Apply Application Files RLS Policies
ALTER TABLE public.application_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_files_select ON public.application_files;
DROP POLICY IF EXISTS application_files_insert ON public.application_files;
DROP POLICY IF EXISTS application_files_update ON public.application_files;
DROP POLICY IF EXISTS application_files_delete ON public.application_files;

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

CREATE POLICY application_files_insert ON public.application_files 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY application_files_update ON public.application_files 
FOR UPDATE 
USING (
  uploader_id = auth.uid()
);

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

-- 7. Apply Rooms RLS Policies
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

-- 8. Apply Room Members RLS Policies
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

-- 9. Room Events RLS
ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_events_select ON public.room_events;
DROP POLICY IF EXISTS room_events_insert ON public.room_events;

CREATE POLICY room_events_select ON public.room_events 
FOR SELECT 
USING (
  is_room_member(room_id, auth.uid()) 
  OR is_active_mentor(room_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_events.room_id AND r.lead_id = auth.uid())
);

CREATE POLICY room_events_insert ON public.room_events 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 10. Dynamic Backfill of Rooms and Members (prevents compile-time column resolution errors)
DO $$
DECLARE
  r RECORD;
  v_room_id UUID;
  v_app RECORD;
BEGIN
  FOR r IN SELECT id, lead_id, title, status FROM public.team_requests WHERE status IN ('open', 'closed', 'full') LOOP
    EXECUTE 'SELECT id FROM public.rooms WHERE initial_request_id = $1 LIMIT 1' INTO v_room_id USING r.id;

    IF v_room_id IS NULL THEN
      EXECUTE 'INSERT INTO public.rooms (name, initial_request_id, lead_id) VALUES ($1, $2, $3) RETURNING id'
      INTO v_room_id USING COALESCE(r.title, 'Project Team Room'), r.id, r.lead_id;

      EXECUTE 'UPDATE public.team_requests SET room_id = $1 WHERE id = $2' USING v_room_id, r.id;
    ELSE
      EXECUTE 'UPDATE public.rooms SET lead_id = $1 WHERE id = $2 AND lead_id IS NULL' USING r.lead_id, v_room_id;
    END IF;

    -- Add lead to room_members
    EXECUTE 'INSERT INTO public.room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
             VALUES ($1, $2, ''lead'', ''active'', true, true, true)
             ON CONFLICT (room_id, user_id) DO UPDATE SET status = ''active'', role = ''lead'''
    USING v_room_id, r.lead_id;

    -- Add all accepted/selected applicants
    FOR v_app IN SELECT applicant_id FROM public.applications WHERE request_id = r.id AND status IN ('accepted', 'selected') LOOP
      EXECUTE 'INSERT INTO public.room_members (room_id, user_id, role, status)
               VALUES ($1, $2, ''member'', ''active'')
               ON CONFLICT (room_id, user_id) DO UPDATE SET status = ''active'''
      USING v_room_id, v_app.applicant_id;
    END LOOP;
  END LOOP;
END;
$$;

-- 11. Storage Buckets & Storage Security Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES 
  ('application-files', 'application-files', false, 10485760),
  ('resumes', 'resumes', false, 10485760),
  ('room-files', 'room-files', false, 52428800)
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Authenticated users can upload application files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read application files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete application files" ON storage.objects;

CREATE POLICY "Authenticated users can upload application files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'application-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read application files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'application-files'
  AND EXISTS (
    SELECT 1 FROM public.application_files af
    JOIN public.applications a ON a.id = af.application_id
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE af.storage_path = storage.objects.name
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

CREATE POLICY "Users can delete application files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'application-files'
  AND EXISTS (
    SELECT 1 FROM public.application_files af
    JOIN public.applications a ON a.id = af.application_id
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE af.storage_path = storage.objects.name
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can read resumes" ON storage.objects;

CREATE POLICY "Authenticated users can upload resumes" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read resumes" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'resumes'
  AND EXISTS (
    SELECT 1 FROM public.application_files af
    JOIN public.applications a ON a.id = af.application_id
    JOIN public.team_requests tr ON tr.id = a.request_id
    WHERE af.storage_path = storage.objects.name
      AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload room files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read room files" ON storage.objects;

CREATE POLICY "Authenticated users can upload room files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read room files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

-- 12. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
