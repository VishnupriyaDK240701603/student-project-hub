-- Align room file metadata with the names used by the application.
ALTER TABLE public.room_files
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.room_files
  ADD COLUMN IF NOT EXISTS file_type TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'room_files' AND column_name = 'uploader_id'
  ) THEN
    EXECUTE 'UPDATE public.room_files SET uploaded_by = COALESCE(uploaded_by, uploader_id) WHERE uploaded_by IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'room_files' AND column_name = 'mime_type'
  ) THEN
    EXECUTE 'UPDATE public.room_files SET file_type = COALESCE(file_type, mime_type) WHERE file_type IS NULL';
  END IF;
END $$;

UPDATE public.room_files
SET file_type = CASE
  WHEN lower(file_name) LIKE '%.pdf' THEN 'application/pdf'
  WHEN lower(file_name) LIKE '%.png' THEN 'image/png'
  WHEN lower(file_name) LIKE '%.jpg' OR lower(file_name) LIKE '%.jpeg' THEN 'image/jpeg'
  WHEN lower(file_name) LIKE '%.txt' THEN 'text/plain'
  WHEN lower(file_name) LIKE '%.doc' THEN 'application/msword'
  WHEN lower(file_name) LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  WHEN lower(file_name) LIKE '%.ppt' THEN 'application/vnd.ms-powerpoint'
  WHEN lower(file_name) LIKE '%.pptx' THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  WHEN lower(file_name) LIKE '%.xls' THEN 'application/vnd.ms-excel'
  WHEN lower(file_name) LIKE '%.xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ELSE 'application/octet-stream'
END
WHERE file_type IS NULL OR file_type = '';

ALTER TABLE public.room_files
  ALTER COLUMN uploaded_by SET NOT NULL,
  ALTER COLUMN file_type SET DEFAULT 'application/octet-stream',
  ALTER COLUMN file_type SET NOT NULL;

-- Replace the legacy uploader_id policy with the application's uploaded_by column.
DROP POLICY IF EXISTS room_files_insert_members ON public.room_files;
CREATE POLICY room_files_insert_members ON public.room_files
  FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()) AND uploaded_by = auth.uid());

NOTIFY pgrst, 'reload schema';
