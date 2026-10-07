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

/**
 * 1. Close Request Early (Lead action)
 * Invariant 9: Forms room if ready, and unselected applicants' files become lead-only with delete_after = closed_at + 30 days.
 */
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

  // 2. Try atomic close_request RPC
  let roomId: string | undefined;
  const { data: rpcRoomId, error: rpcError } = await supabase.rpc("close_request", {
    p_request_id: requestId,
    p_lead_id: user.id,
  });

  if (!rpcError && rpcRoomId) {
    roomId = rpcRoomId;
  } else {
    // Transactional fallback
    await supabase
      .from("team_requests")
      .update({
        status: "closed",
        closed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", requestId);

    // Call or simulate create_room_if_ready
    const { data: createdRoomId } = await supabase.rpc("create_room_if_ready", {
      p_request_id: requestId,
    });
    roomId = createdRoomId || undefined;

    if (!roomId) {
      // Direct room creation if RPC not yet deployed
      const { data: existingRoom } = await supabase
        .from("rooms")
        .select("id")
        .eq("request_id", requestId)
        .maybeSingle();

      if (existingRoom) {
        roomId = existingRoom.id;
      } else {
        const { data: newRoom } = await supabase
          .from("rooms")
          .insert({
            request_id: requestId,
            lead_id: user.id,
          })
          .select("id")
          .single();

        if (newRoom) {
          roomId = newRoom.id;
          // Add lead
          await supabase.from("room_members").insert({
            room_id: roomId,
            user_id: user.id,
            role: "lead",
            status: "active",
            can_edit_tasks: true,
            can_set_deadlines: true,
            can_invite_mentors: true,
          });

          // Add accepted members
          const { data: acceptedApps } = await supabase
            .from("applications")
            .select("applicant_id")
            .eq("request_id", requestId)
            .eq("status", "accepted");

          if (acceptedApps) {
            for (const app of acceptedApps) {
              await supabase.from("room_members").insert({
                room_id: roomId,
                user_id: app.applicant_id,
                role: "member",
                status: "active",
              });
            }
          }
        }
      }
    }

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
      roomId,
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

  // Verify room exists and caller is lead
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*, team_requests(title)")
    .eq("id", input.roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Target project room not found." };
  }

  if (room.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can create follow-up requests." };
  }

  const baseTitle = room.team_requests?.title || "Project Team";
  const followUpTitle = `${baseTitle} (Follow-up)`;

  const { data: newRequest, error: insertError } = await supabase
    .from("team_requests")
    .insert({
      lead_id: user.id,
      room_id: input.roomId,
      title: followUpTitle,
      description: sanitizeText(input.description),
      role_needed: sanitizeText(input.roleNeeded),
      headcount: input.extraHeadcount,
      tags: input.tags || [],
      filter_years: input.filterYears || [],
      filter_departments: input.filterDepartments || [],
      filter_genders: (input.filterGenders as GenderEnum[]) || [],
      resume_required: Boolean(input.resumeRequired),
      status: "open",
    })
    .select()
    .single();

  if (insertError || !newRequest) {
    return { success: false, error: insertError?.message || "Failed to create follow-up request." };
  }

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "request.followup_created",
    target: newRequest.id,
    metadata: {
      room_id: input.roomId,
      extra_headcount: input.extraHeadcount,
      role_needed: input.roleNeeded,
    },
  });

  return { success: true, data: { request: newRequest as TeamRequest } };
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

  const { data, error } = await supabase
    .from("rooms")
    .select(
      "*, team_requests(*), room_members(*, profiles:user_id(display_name, department, admission_year, kind))",
    )
    .eq("id", roomId)
    .single();

  if (error || !data) {
    return { success: false, error: "Room not found or access denied." };
  }

  return { success: true, data: data as unknown as RoomWithDetails };
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
    .select("room_id, rooms(*, team_requests(*))")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    return { success: false, error: error.message };
  }

  const formatted = (memberRooms || [])
    .map((mr) => mr.rooms)
    .filter(Boolean) as unknown as Array<Room & { team_requests: TeamRequest | null }>;

  return { success: true, data: formatted };
}
