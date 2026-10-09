-- Allow active room members to view and create meetings, and allow creators or
-- active room leads to delete them.

GRANT SELECT, INSERT, DELETE ON TABLE public.meetings TO authenticated;

CREATE POLICY meetings_select_room_members ON meetings
  FOR SELECT USING (is_room_member(room_id, auth.uid()));

CREATE POLICY meetings_insert_room_members ON meetings
  FOR INSERT WITH CHECK (
    is_room_member(room_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY meetings_delete_creator_or_lead ON meetings
  FOR DELETE USING (
    is_room_member(room_id, auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM room_members rm
        WHERE rm.room_id = meetings.room_id
          AND rm.user_id = auth.uid()
          AND rm.role = 'lead'
          AND rm.status = 'active'
      )
    )
  );
