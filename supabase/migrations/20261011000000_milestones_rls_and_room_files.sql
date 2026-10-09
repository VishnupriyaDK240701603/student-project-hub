-- Complete Row-Level Security Policies for Student Project Hub

-- 1. Grant table access
GRANT ALL ON TABLE public.task_assignees TO authenticated;
GRANT ALL ON TABLE public.task_comments TO authenticated;
GRANT ALL ON TABLE public.task_attachments TO authenticated;
GRANT ALL ON TABLE public.milestones TO authenticated;
GRANT ALL ON TABLE public.meetings TO authenticated;
GRANT ALL ON TABLE public.reactions TO authenticated;
GRANT ALL ON TABLE public.mentions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.ai_usage TO authenticated;

-- 2. Task Assignees Policies
DROP POLICY IF EXISTS task_assignees_select_members ON public.task_assignees;
CREATE POLICY task_assignees_select_members ON public.task_assignees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND (is_room_member(t.room_id, auth.uid()) OR is_active_mentor(t.room_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS task_assignees_insert_members ON public.task_assignees;
CREATE POLICY task_assignees_insert_members ON public.task_assignees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND is_room_member(t.room_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS task_assignees_delete_members ON public.task_assignees;
CREATE POLICY task_assignees_delete_members ON public.task_assignees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND is_room_member(t.room_id, auth.uid())
    )
  );

-- 3. Task Comments Policies
DROP POLICY IF EXISTS task_comments_select_members ON public.task_comments;
CREATE POLICY task_comments_select_members ON public.task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (is_room_member(t.room_id, auth.uid()) OR is_active_mentor(t.room_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS task_comments_insert_members ON public.task_comments;
CREATE POLICY task_comments_insert_members ON public.task_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND is_room_member(t.room_id, auth.uid())
    )
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS task_comments_delete_author ON public.task_comments;
CREATE POLICY task_comments_delete_author ON public.task_comments
  FOR DELETE USING (author_id = auth.uid());

-- 4. Task Attachments Policies
DROP POLICY IF EXISTS task_attachments_select_members ON public.task_attachments;
CREATE POLICY task_attachments_select_members ON public.task_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
        AND (is_room_member(t.room_id, auth.uid()) OR is_active_mentor(t.room_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS task_attachments_insert_members ON public.task_attachments;
CREATE POLICY task_attachments_insert_members ON public.task_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
        AND is_room_member(t.room_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS task_attachments_delete_members ON public.task_attachments;
CREATE POLICY task_attachments_delete_members ON public.task_attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
        AND is_room_member(t.room_id, auth.uid())
    )
  );

-- 5. Milestones Policies
DROP POLICY IF EXISTS milestones_select_room_members ON public.milestones;
CREATE POLICY milestones_select_room_members ON public.milestones
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

DROP POLICY IF EXISTS milestones_insert_room_members ON public.milestones;
CREATE POLICY milestones_insert_room_members ON public.milestones
  FOR INSERT WITH CHECK (is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS milestones_update_room_members ON public.milestones;
CREATE POLICY milestones_update_room_members ON public.milestones
  FOR UPDATE USING (is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS milestones_delete_room_members ON public.milestones;
CREATE POLICY milestones_delete_room_members ON public.milestones
  FOR DELETE USING (is_room_member(room_id, auth.uid()));

-- 6. Meetings Policies
DROP POLICY IF EXISTS meetings_select_room_members ON public.meetings;
CREATE POLICY meetings_select_room_members ON public.meetings
  FOR SELECT USING (is_room_member(room_id, auth.uid()) OR is_active_mentor(room_id, auth.uid()));

DROP POLICY IF EXISTS meetings_insert_room_members ON public.meetings;
CREATE POLICY meetings_insert_room_members ON public.meetings
  FOR INSERT WITH CHECK (
    is_room_member(room_id, auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS meetings_delete_creator_or_lead ON public.meetings;
CREATE POLICY meetings_delete_creator_or_lead ON public.meetings
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

-- 7. Reactions & Mentions Policies
DROP POLICY IF EXISTS reactions_select ON public.reactions;
CREATE POLICY reactions_select ON public.reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS reactions_insert ON public.reactions;
CREATE POLICY reactions_insert ON public.reactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS reactions_delete ON public.reactions;
CREATE POLICY reactions_delete ON public.reactions FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS mentions_select ON public.mentions;
CREATE POLICY mentions_select ON public.mentions FOR SELECT USING (true);

DROP POLICY IF EXISTS mentions_insert ON public.mentions;
CREATE POLICY mentions_insert ON public.mentions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS mentions_delete ON public.mentions;
CREATE POLICY mentions_delete ON public.mentions FOR DELETE USING (auth.uid() IS NOT NULL);

-- 8. Push Subscriptions & AI Usage Policies
DROP POLICY IF EXISTS push_subscriptions_all_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_all_own ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_usage_all_own ON public.ai_usage;
CREATE POLICY ai_usage_all_own ON public.ai_usage
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
