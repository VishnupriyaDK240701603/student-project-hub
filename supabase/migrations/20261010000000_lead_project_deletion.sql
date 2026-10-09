-- Allow team leads to remove their own request or room. Related project rows
-- continue to be removed through their existing foreign-key cascades.
DROP POLICY IF EXISTS team_requests_delete_lead ON public.team_requests;
CREATE POLICY team_requests_delete_lead ON public.team_requests
  FOR DELETE USING (lead_id = auth.uid());

DROP POLICY IF EXISTS rooms_delete_lead ON public.rooms;
CREATE POLICY rooms_delete_lead ON public.rooms
  FOR DELETE USING (lead_id = auth.uid());

-- Application uploads are private to the applicant and the request's lead.
DROP POLICY IF EXISTS "Users can read application files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read resumes" ON storage.objects;
DROP POLICY IF EXISTS application_files_read_owner_storage ON storage.objects;
CREATE POLICY application_files_read_owner_storage ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('application-files', 'resumes')
    AND EXISTS (
      SELECT 1
      FROM public.application_files af
      JOIN public.applications a ON a.id = af.application_id
      JOIN public.team_requests tr ON tr.id = a.request_id
      WHERE af.storage_path = storage.objects.name
        AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
    )
  );

-- Storage objects must be removed before their metadata rows are cascaded.
-- Replace the legacy bucket-wide delete grant with per-application ownership.
DROP POLICY IF EXISTS "Users can delete application files" ON storage.objects;
DROP POLICY IF EXISTS application_files_delete_owner_storage ON storage.objects;

CREATE POLICY application_files_delete_owner_storage ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('application-files', 'resumes')
    AND EXISTS (
      SELECT 1
      FROM public.application_files af
      JOIN public.applications a ON a.id = af.application_id
      JOIN public.team_requests tr ON tr.id = a.request_id
      WHERE af.storage_path = storage.objects.name
        AND (a.applicant_id = auth.uid() OR tr.lead_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS room_files_delete_uploader_or_lead_storage ON storage.objects;
CREATE POLICY room_files_delete_uploader_or_lead_storage ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'room-files'
    AND EXISTS (
      SELECT 1 FROM public.room_files rf
      JOIN public.rooms r ON r.id = rf.room_id
      WHERE rf.storage_path = storage.objects.name
        AND (rf.uploaded_by = auth.uid() OR r.lead_id = auth.uid())
    )
  );
