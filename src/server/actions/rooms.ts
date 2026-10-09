"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import {
  calculateRetentionExpiry,
  validateFollowUpRequestInput,
  type FollowUpRequestInput,
} from "@/lib/retention-validation";
import type { TeamRequest, Room, RoomMember, Profile, GenderEnum } from "@/types/database.types";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RoomWithDetails extends Room {
  team_requests: TeamRequest | null;
  room_members: (RoomMember & { profiles: Profile | null })[];
}

/** Permanently remove a team request and its associated room and uploaded files. */
export async function deleteTeamRequestAction(requestId: string): Promise<ActionResult<{ deleted: true }>> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to delete this request." };

  const { data: request, error: requestError } = await supabase
    .from("team_requests").select("id, lead_id, room_id").eq("id", requestId).maybeSingle();
  if (requestError || !request) return { success: false, error: "Team request not found." };
  if (request.lead_id !== user.id) return { success: false, error: "Only the team lead can delete this request." };

  let roomId = request.room_id as string | null;
  if (!roomId) {
    const { data: room } = await supabase.from("rooms").select("id").eq("initial_request_id", requestId).maybeSingle();
    roomId = room?.id ?? null;
  }

  // Best-effort cleanup of application storage files
  const { data: applications } = await supabase.from("applications").select("id").eq("request_id", requestId);
  const appIds = (applications ?? []).map((app) => app.id);
  if (appIds.length) {
    const { data: files } = await supabase.from("application_files").select("storage_path").in("application_id", appIds);
    const paths = (files ?? []).map((file) => file.storage_path);
    if (paths.length) {
      await supabase.storage.from("application-files").remove(paths);
      await supabase.storage.from("resumes").remove(paths);
    }
  }

  // Best-effort cleanup of room storage files & room record
  if (roomId) {
    const { data: roomFiles } = await supabase.from("room_files").select("storage_path").eq("room_id", roomId);
    const { data: tasks } = await supabase.from("tasks").select("id").eq("room_id", roomId);
    const taskIds = (tasks ?? []).map((task) => task.id);
    const { data: attachments } = taskIds.length
      ? await supabase.from("task_attachments").select("storage_path").in("task_id", taskIds)
      : { data: [] };
    const paths = [...(roomFiles ?? []), ...(attachments ?? [])].map((file) => file.storage_path);
    if (paths.length) {
      await supabase.storage.from("room-files").remove(paths);
    }
    const { error: roomDeleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", roomId);
    if (roomDeleteError) return { success: false, error: roomDeleteError.message };
  }

  const { error } = await supabase
    .from("team_requests")
    .delete()
    .eq("id", requestId)
    .eq("lead_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { deleted: true } };
}

/** Remove a room while preserving its original team request. */
export async function deleteProjectRoomAction(roomId: string): Promise<ActionResult<{ deleted: true }>> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Please sign in to delete this room." };
  const { data: room, error: roomError } = await supabase.from("rooms").select("id, lead_id").eq("id", roomId).maybeSingle();
  if (roomError || !room) return { success: false, error: "Project room not found." };
  if (room.lead_id !== user.id) return { success: false, error: "Only the team lead can delete this room." };

  const { data: files } = await supabase.from("room_files").select("storage_path").eq("room_id", roomId);
  const { data: tasks } = await supabase.from("tasks").select("id").eq("room_id", roomId);
  const taskIds = (tasks ?? []).map((task) => task.id);
  const { data: attachments } = taskIds.length
    ? await supabase.from("task_attachments").select("storage_path").in("task_id", taskIds)
    : { data: [] };
  const paths = [...(files ?? []), ...(attachments ?? [])].map((file) => file.storage_path);
  if (paths.length) {
    await supabase.storage.from("room-files").remove(paths);
  }

  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", roomId)
    .eq("lead_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { deleted: true } };
}

/**
 * Helper to guarantee room creation, link team_requests.room_id, and populate room_members
 */
export async function ensureRoomForRequest(
  requestId: string,
  leadId: string,
  title: string,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();

  // 1. Check if room already exists for this request
  const { data: existingRoom } = await supabase
    .from("rooms")
    .select("id")
    .eq("initial_request_id", requestId)
    .maybeSingle();

  let roomId = existingRoom?.id || null;

  // Also check if team_requests already has room_id
  if (!roomId) {
    const { data: req } = await supabase
      .from("team_requests")
      .select("room_id")
      .eq("id", requestId)
      .maybeSingle();
    if (req?.room_id) {
      roomId = req.room_id;
    }
  }

  // 2. Create room if it does not exist
  if (!roomId) {
    const roomName = title || "Project Team Room";

    const { data: newRoom, error: createError } = await supabase
      .from("rooms")
      .insert({
        name: roomName,
        initial_request_id: requestId,
        lead_id: leadId,
      })
      .select("id")
      .maybeSingle();

    if (createError || !newRoom) {
      console.error("Failed to create room:", createError?.message);
      return null;
    }

    roomId = newRoom.id;
  }

  if (!roomId) return null;

  // 3. Link room_id to team_requests table
  await supabase
    .from("team_requests")
    .update({ room_id: roomId })
    .eq("id", requestId);

  // 4. Ensure lead is active in room_members
  await supabase.from("room_members").upsert(
    {
      room_id: roomId,
      user_id: leadId,
      role: "lead",
      status: "active",
      can_edit_tasks: true,
      can_set_deadlines: true,
      can_invite_mentors: true,
    },
    { onConflict: "room_id,user_id" },
  );

  // 5. Promote selected apps to accepted and populate room_members
  const { data: teamApps } = await supabase
    .from("applications")
    .select("applicant_id, status")
    .eq("request_id", requestId)
    .in("status", ["accepted", "selected"]);

  if (teamApps && teamApps.length > 0) {
    for (const app of teamApps) {
      if (app.status === "selected") {
        await supabase
          .from("applications")
          .update({ status: "accepted", updated_at: new Date().toISOString() })
          .eq("request_id", requestId)
          .eq("applicant_id", app.applicant_id);
      }

      await supabase.from("room_members").upsert(
        {
          room_id: roomId,
          user_id: app.applicant_id,
          role: "member",
          status: "active",
        },
        { onConflict: "room_id,user_id" },
      );
    }
  }

  return roomId;
}

/**
 * Finalize Team & Form Project Room (Lead action)
 * Invariant 9: Forms room when team lead finalizes the team or closes recruitment,
 * populates confirmed members into room_members, and sets 30-day retention on unselected applicants' files.
 */
export async function finalizeTeamAction(
  requestId: string,
): Promise<ActionResult<{ closed: boolean; roomId?: string }>> {
  return closeRequestAction(requestId);
}

export async function closeRequestAction(
  requestId: string,
): Promise<ActionResult<{ closed: boolean; roomId?: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // 1. Fetch request ensuring lead ownership
  const { data: request, error: reqError } = await supabase
    .from("team_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return { success: false, error: "Team request not found." };
  }

  if (request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can close this request." };
  }

  if (request.status === "closed") {
    return { success: false, error: "This request is already closed." };
  }

  const nowIso = new Date().toISOString();
  const retentionExpiry = calculateRetentionExpiry(new Date());

  // Mark request status as closed
  await supabase
    .from("team_requests")
    .update({
      status: "closed",
      closed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", requestId);

  // Guarantee room creation and link team_requests.room_id
  const roomId = await ensureRoomForRequest(requestId, user.id, request.title);
    // Set 30-day retention on unselected candidates' files
    const { data: unselectedApps } = await supabase
      .from("applications")
      .select("id")
      .eq("request_id", requestId)
      .neq("status", "accepted");

    if (unselectedApps && unselectedApps.length > 0) {
      const appIds = unselectedApps.map((a) => a.id);
      await supabase
        .from("application_files")
        .update({ delete_after: retentionExpiry })
        .in("application_id", appIds);
    }

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "request.closed",
    target: requestId,
    metadata: {
      room_id: roomId || null,
      closed_at: nowIso,
      retention_expiry: retentionExpiry,
    },
  });

  return {
    success: true,
    data: {
      closed: true,
      roomId: roomId || undefined,
    },
  };
}

/**
 * 2. Create Follow-Up Request (Lead action)
 * Requirement 2: Linked to existing room, shows current members, extra people needed.
 * Accepted people join the same room automatically.
 */
export async function createFollowUpRequestAction(
  input: FollowUpRequestInput,
): Promise<ActionResult<{ request: TeamRequest }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = validateFollowUpRequestInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Verify the project room exists and caller is its current lead.
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, lead_id, initial_request_id")
    .eq("id", input.roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Target project room not found." };
  }

  if (room.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can create follow-up requests." };
  }

  if (!room.initial_request_id) {
    return { success: false, error: "This project room is not linked to an original request." };
  }

  const { data: previousRequest, error: requestError } = await supabase
    .from("team_requests")
    .select("id, lead_id, title, status, room_id")
    .eq("id", room.initial_request_id)
    .single();

  if (requestError || !previousRequest) {
    return { success: false, error: "Original project request not found." };
  }

  if (previousRequest.lead_id !== user.id) {
    return { success: false, error: "Only the original project lead can reopen this request." };
  }

  if (previousRequest.status !== "closed") {
    return { success: false, error: "Close the previous request before publishing a follow-up." };
  }

  if (previousRequest.room_id && previousRequest.room_id !== input.roomId) {
    return { success: false, error: "This request is linked to a different project room." };
  }

  const { count: acceptedCount, error: acceptedCountError } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("request_id", previousRequest.id)
    .eq("status", "accepted");

  if (acceptedCountError) {
    return { success: false, error: "Could not verify the current team size." };
  }

  // Close any legacy follow-up rows for this room so only the original project card remains open.
  const now = new Date().toISOString();
  const { error: legacyCloseError } = await supabase
    .from("team_requests")
    .update({ status: "closed", closed_at: now, updated_at: now })
    .eq("room_id", input.roomId)
    .neq("id", previousRequest.id)
    .eq("status", "open");

  if (legacyCloseError) {
    return { success: false, error: "Could not close an older request for this project." };
  }

  const { data: updatedRequest, error: updateError } = await supabase
    .from("team_requests")
    .update({
      room_id: input.roomId,
      description: sanitizeText(input.description),
      role_needed: sanitizeText(input.roleNeeded),
      headcount: (acceptedCount || 0) + input.extraHeadcount,
      tags: input.tags || [],
      filter_years: input.filterYears || [],
      filter_departments: input.filterDepartments || [],
      filter_genders: (input.filterGenders as GenderEnum[]) || [],
      resume_required: Boolean(input.resumeRequired),
      status: "open",
      closed_at: null,
      updated_at: now,
    })
    .eq("id", previousRequest.id)
    .eq("status", "closed")
    .select()
    .single();

  if (updateError || !updatedRequest) {
    return { success: false, error: updateError?.message || "Could not reopen the project request." };
  }

  // Write audit log entry against the existing project request card.
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "request.followup_reopened",
    target: updatedRequest.id,
    metadata: {
      room_id: input.roomId,
      extra_headcount: input.extraHeadcount,
      role_needed: input.roleNeeded,
      reused_request: true,
    },
  });

  return { success: true, data: { request: updatedRequest as TeamRequest } };
}

/**
 * 3. Daily Retention Job for Hard Deleting Expired Resumes
 * Invariant 9: Hard-deletes expired files from storage and database.
 * Requirement: Idempotent and logged (IDs only). Time-travel testable.
 */
export async function cleanExpiredApplicationFilesAction(
  currentTime: Date = new Date(),
): Promise<ActionResult<{ deletedCount: number; deletedIds: string[] }>> {
  const supabase = await createServerSupabaseClient();
  const currentIso = currentTime.toISOString();

  // Find all files where delete_after <= currentIso
  const { data: expiredFiles, error: fetchError } = await supabase
    .from("application_files")
    .select("id, storage_path")
    .not("delete_after", "is", null)
    .lte("delete_after", currentIso);

  if (fetchError || !expiredFiles || expiredFiles.length === 0) {
    return { success: true, data: { deletedCount: 0, deletedIds: [] } };
  }

  const paths = expiredFiles.map((f) => f.storage_path);
  const ids = expiredFiles.map((f) => f.id);

  // 1. Hard delete from Supabase storage bucket
  await supabase.storage.from("application-files").remove(paths);

  // 2. Hard delete records from database table
  const { error: deleteError } = await supabase
    .from("application_files")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // 3. Write audit log (IDs only, never content)
  await supabase.from("audit_log").insert({
    actor_id: null, // System maintenance job
    action: "application_files.retention_cleanup",
    target: "application_files",
    metadata: {
      deleted_count: ids.length,
      file_ids: ids,
      executed_at: currentIso,
    },
  });

  return {
    success: true,
    data: {
      deletedCount: ids.length,
      deletedIds: ids,
    },
  };
}

/**
 * 4. Fetch Room with Members (For Follow-Up Request overview and room navigation)
 */
export async function getRoomDetailsAction(
  roomId: string,
): Promise<ActionResult<RoomWithDetails>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: room, error } = await supabase
    .from("rooms")
    .select(
      "*, room_members(*, profiles:user_id(display_name, department, admission_year, kind))",
    )
    .eq("id", roomId)
    .single();

  if (error || !room) {
    return { success: false, error: "Room not found or access denied." };
  }

  // Fetch linked team request
  let linkedRequest: TeamRequest | null = null;
  if (room.initial_request_id) {
    const { data: req } = await supabase
      .from("team_requests")
      .select("*")
      .eq("id", room.initial_request_id)
      .maybeSingle();
    linkedRequest = req as TeamRequest | null;
  }
  if (!linkedRequest) {
    const { data: req } = await supabase
      .from("team_requests")
      .select("*")
      .eq("room_id", roomId)
      .maybeSingle();
    linkedRequest = req as TeamRequest | null;
  }

  return {
    success: true,
    data: {
      ...room,
      team_requests: linkedRequest,
    } as unknown as RoomWithDetails,
  };
}

/**
 * 5. Fetch User's Active Rooms
 */
export async function getMyRoomsAction(): Promise<
  ActionResult<Array<Room & { team_requests: TeamRequest | null }>>
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: memberRooms, error } = await supabase
    .from("room_members")
    .select("room_id, rooms(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    return { success: false, error: error.message };
  }

  const rawRooms = (memberRooms || [])
    .map((mr) => mr.rooms)
    .filter(Boolean) as unknown as Room[];

  if (rawRooms.length === 0) {
    return { success: true, data: [] };
  }

  const roomIds = rawRooms.map((r) => r.id);
  const initialReqIds = rawRooms.map((r) => r.initial_request_id).filter(Boolean) as string[];

  // Fetch team requests linked to these rooms
  const orFilters = [`room_id.in.(${roomIds.join(",")})`];
  if (initialReqIds.length > 0) {
    orFilters.push(`id.in.(${initialReqIds.join(",")})`);
  }

  const { data: linkedRequests } = await supabase
    .from("team_requests")
    .select("*")
    .or(orFilters.join(","));

  const reqMap = new Map<string, TeamRequest>();
  (linkedRequests || []).forEach((req) => {
    if (req.room_id) reqMap.set(req.room_id, req as TeamRequest);
    if (req.id) reqMap.set(req.id, req as TeamRequest);
  });

  const formatted = rawRooms.map((room) => ({
    ...room,
    team_requests: reqMap.get(room.id) || (room.initial_request_id ? reqMap.get(room.initial_request_id) : null) || null,
  }));

  return { success: true, data: formatted };
}
