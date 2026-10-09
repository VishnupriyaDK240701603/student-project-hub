-- ====================================================================
-- BACKFILL ROOMS FOR EXISTING REQUESTS
-- Run this in your Supabase SQL Editor to generate rooms for any
-- existing requests and populate room_members:
-- https://supabase.com/dashboard/project/vwfkxwhlopsmbyqgeagz/sql
-- ====================================================================

DO $$
DECLARE
  r RECORD;
  v_room_id UUID;
  v_app RECORD;
BEGIN
  FOR r IN SELECT id, lead_id, title, status FROM public.team_requests WHERE status IN ('open', 'closed', 'full') LOOP
    -- Check if room already exists
    SELECT id INTO v_room_id FROM public.rooms WHERE initial_request_id = r.id;

    IF v_room_id IS NULL THEN
      -- Create room
      INSERT INTO public.rooms (name, initial_request_id, lead_id)
      VALUES (COALESCE(r.title, 'Project Team Room'), r.id, r.lead_id)
      RETURNING id INTO v_room_id;

      -- Update team_requests.room_id
      UPDATE public.team_requests SET room_id = v_room_id WHERE id = r.id;
    END IF;

    -- Add lead to room_members
    INSERT INTO public.room_members (room_id, user_id, role, status, can_edit_tasks, can_set_deadlines, can_invite_mentors)
    VALUES (v_room_id, r.lead_id, 'lead', 'active', true, true, true)
    ON CONFLICT (room_id, user_id) DO UPDATE
    SET status = 'active', role = 'lead';

    -- Add all accepted/selected applicants to room_members
    FOR v_app IN SELECT applicant_id FROM public.applications WHERE request_id = r.id AND status IN ('accepted', 'selected') LOOP
      INSERT INTO public.room_members (room_id, user_id, role, status)
      VALUES (v_room_id, v_app.applicant_id, 'member', 'active')
      ON CONFLICT (room_id, user_id) DO UPDATE
      SET status = 'active';
    END LOOP;
  END LOOP;
END;
$$;

-- Verify created rooms
SELECT r.id, r.name, r.initial_request_id, r.lead_id, count(m.id) as member_count
FROM public.rooms r
LEFT JOIN public.room_members m ON m.room_id = r.id
GROUP BY r.id, r.name, r.initial_request_id, r.lead_id;
