-- ==============================================================================
-- CREATE SUPABASE STORAGE BUCKETS & RLS POLICIES
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ==============================================================================

-- 1. Create 'application-files' Bucket (Private, 10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'application-files',
  'application-files',
  false,
  10485760 -- 10 MB limit
)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = 10485760;

-- 2. Create 'resumes' Bucket (Private, 10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760 -- 10 MB limit
)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = 10485760;

-- 3. Create 'room-files' Bucket (Private, 50MB limit for team code/docs)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'room-files',
  'room-files',
  false,
  52428800 -- 50 MB limit
)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = 52428800;

-- 4. Storage Security Policies for 'application-files'
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

-- 5. Storage Security Policies for 'resumes'
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can read resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete resumes" ON storage.objects;

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

CREATE POLICY "Users can delete resumes"
ON storage.objects FOR DELETE
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

-- 6. Storage Security Policies for 'room-files'
DROP POLICY IF EXISTS "Authenticated users can upload room files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read room files" ON storage.objects;
DROP POLICY IF EXISTS "Room members can delete own room files" ON storage.objects;

CREATE POLICY "Authenticated users can upload room files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read room files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'room-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Room members can delete own room files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'room-files'
  AND EXISTS (
    SELECT 1 FROM public.room_files rf
    JOIN public.rooms r ON r.id = rf.room_id
    WHERE rf.storage_path = storage.objects.name
      AND (rf.uploaded_by = auth.uid() OR r.lead_id = auth.uid())
  )
);
