"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  validateRemovalReason,
  sanitizeMemberPermissions,
  validateLeadSwapInitiation,
  validateReAddEligibility,
} from "@/lib/room-management-validation";
import type { RoomMember, Profile, RoomEvent, LeadTransfer } from "@/types/database.types";
import type { ActionResult } from "./rooms";

export interface RoomEventWithActor extends RoomEvent {
  actor: {
    id: string;
    display_name: string;
    department: string;
  } | null;
}

export interface RoomMemberWithProfile extends RoomMember {
  profiles: Profile | null;
}

/**
 * 1. Update Member Permissions (Lead Only)
 * Sets per-member permissions: can_edit_tasks, can_set_deadlines, can_invite_mentors.
 */
export async function updateMemberPermissionsAction(
  roomId: string,
  targetUserId: string,
  permissionsInput: {
    can_edit_tasks?: boolean;
    can_set_deadlines?: boolean;
    can_invite_mentors?: boolean;
  },
): Promise<ActionResult<{ updated: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const permissions = sanitizeMemberPermissions(permissionsInput);

  // Try database stored procedure first
  const { data: rpcRes, error: rpcError } = await supabase.rpc("update_member_permissions", {
    p_room_id: roomId,
    p_lead_id: user.id,
    p_target_user_id: targetUserId,
    p_can_edit_tasks: permissions.can_edit_tasks,
    p_can_set_deadlines: permissions.can_set_deadlines,
    p_can_invite_mentors: permissions.can_invite_mentors,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, data: { updated: true } };
  }

  // Fallback transactional flow
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("lead_id")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Project room not found." };
  }

  if (room.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can configure member permissions." };
  }

  if (targetUserId === user.id) {
    return { success: false, error: "Lead permissions cannot be modified directly." };
  }

  const { error: updateError } = await supabase
    .from("room_members")
    .update({
      can_edit_tasks: permissions.can_edit_tasks,
      can_set_deadlines: permissions.can_set_deadlines,
      can_invite_mentors: permissions.can_invite_mentors,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .eq("status", "active");

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Insert room event
  await supabase.from("room_events").insert({
    room_id: roomId,
    actor_id: user.id,
    event_type: "permissions_updated",
    metadata: {
      target_user_id: targetUserId,
      ...permissions,
    },
  });

  // Insert audit log (IDs only)
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.permissions_updated",
    target: roomId,
    metadata: {
      target_user_id: targetUserId,
      ...permissions,
    },
  });

  return { success: true, data: { updated: true } };
}

/**
 * 2. Offer Lead Swap (Flow A: Lead offers leadership to teammate)
 */
export async function offerLeadSwapAction(
  roomId: string,
  targetUserId: string,
): Promise<ActionResult<{ transferId: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("lead_id, team_requests(title)")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Project room not found." };
  }

  const val = validateLeadSwapInitiation(user.id, room.lead_id, targetUserId);
  if (!val.valid || val.flow !== "offer") {
    return { success: false, error: val.error || "Only the current lead can offer leadership." };
  }

  // Verify target is an active non-mentor member
  const { data: targetMember } = await supabase
    .from("room_members")
    .select("role, status")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .single();

  if (!targetMember || targetMember.status !== "active" || targetMember.role === "mentor") {
    return { success: false, error: "Leadership can only be offered to active student team members." };
  }

  // Create lead transfer record (status = 'selected' for offer)
  const { data: transfer, error: insertError } = await supabase
    .from("lead_transfers")
    .insert({
      room_id: roomId,
      current_lead_id: user.id,
      target_lead_id: targetUserId,
      status: "selected",
    })
    .select()
    .single();

  if (insertError || !transfer) {
    return { success: false, error: insertError?.message || "Failed to create lead transfer offer." };
  }

  // Send notification to teammate
  const projectTitle = (room.team_requests as unknown as { title: string })?.title || "Project Room";
  await supabase.from("notifications").insert({
    user_id: targetUserId,
    type: "lead_swap_offered",
    title: "Leadership Offer Received",
    body: `You have been offered leadership of team "${projectTitle}". Accept or decline in your inbox.`,
    link: `/rooms/${roomId}?tab=members`,
  });

  // Write audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.lead_swap_offered",
    target: roomId,
    metadata: {
      transfer_id: transfer.id,
      target_user_id: targetUserId,
    },
  });

  return { success: true, data: { transferId: transfer.id } };
}

/**
 * 3. Request Lead Swap (Flow B: Teammate asks lead for leadership)
 */
export async function requestLeadSwapAction(
  roomId: string,
): Promise<ActionResult<{ transferId: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("lead_id, team_requests(title)")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Project room not found." };
  }

  if (room.lead_id === user.id) {
    return { success: false, error: "You are already the project lead." };
  }

  // Verify caller is active member
  const { data: member } = await supabase
    .from("room_members")
    .select("role, status")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.status !== "active" || member.role === "mentor") {
    return { success: false, error: "Only active student team members can request leadership." };
  }

  // Create lead transfer record (status = 'applied' for request)
  const { data: transfer, error: insertError } = await supabase
    .from("lead_transfers")
    .insert({
      room_id: roomId,
      current_lead_id: room.lead_id,
      target_lead_id: user.id,
      status: "applied",
    })
    .select()
    .single();

  if (insertError || !transfer) {
    return { success: false, error: insertError?.message || "Failed to submit leadership request." };
  }

  // Send notification to current lead
  const projectTitle = (room.team_requests as unknown as { title: string })?.title || "Project Room";
  await supabase.from("notifications").insert({
    user_id: room.lead_id,
    type: "lead_swap_requested",
    title: "Leadership Request Received",
    body: `A teammate has requested leadership for "${projectTitle}". Review in your room members tab.`,
    link: `/rooms/${roomId}?tab=members`,
  });

  // Write audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.lead_swap_requested",
    target: roomId,
    metadata: {
      transfer_id: transfer.id,
      lead_id: room.lead_id,
    },
  });

  return { success: true, data: { transferId: transfer.id } };
}

/**
 * 4. Respond to Lead Swap (Accept or Reject)
 * Atomically updates rooms.lead_id, team_requests.lead_id, applicants, and waitlists.
 */
export async function respondToLeadSwapAction(
  transferId: string,
  accept: boolean,
): Promise<ActionResult<{ status: string; newLeadId?: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // 1. Try atomic database stored procedure
  const { data: rpcRes, error: rpcError } = await supabase.rpc("execute_lead_swap", {
    p_transfer_id: transferId,
    p_responder_id: user.id,
    p_accept: accept,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; status?: string; new_lead_id?: string; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, data: { status: res.status || (accept ? "accepted" : "rejected"), newLeadId: res.new_lead_id } };
  }

  // 2. Transactional fallback
  const { data: transfer, error: transferError } = await supabase
    .from("lead_transfers")
    .select("*, rooms(*)")
    .eq("id", transferId)
    .single();

  if (transferError || !transfer) {
    return { success: false, error: "Lead transfer request not found." };
  }

  if (transfer.status !== "applied" && transfer.status !== "selected") {
    return { success: false, error: "This leadership transfer is no longer pending." };
  }

  // Check responder authorization
  if (transfer.status === "selected" && transfer.target_lead_id !== user.id) {
    return { success: false, error: "Only the invited teammate can accept or decline this offer." };
  }
  if (transfer.status === "applied" && transfer.current_lead_id !== user.id) {
    return { success: false, error: "Only the current project lead can approve or reject this request." };
  }

  if (!accept) {
    await supabase.from("lead_transfers").update({ status: "rejected" }).eq("id", transferId);
    await supabase.from("room_events").insert({
      room_id: transfer.room_id,
      actor_id: user.id,
      event_type: "lead_swap_declined",
      metadata: { transfer_id: transferId },
    });
    return { success: true, data: { status: "rejected" } };
  }

  // Perform swap
  const newLeadId = transfer.target_lead_id;
  const oldLeadId = transfer.current_lead_id;

  // A. Room update
  await supabase.from("rooms").update({ lead_id: newLeadId, updated_at: new Date().toISOString() }).eq("id", transfer.room_id);

  // B. Team requests update (moves request ownership, applicants and waitlist)
  await supabase
    .from("team_requests")
    .update({ lead_id: newLeadId, updated_at: new Date().toISOString() })
    .or(`room_id.eq.${transfer.room_id},id.eq.${transfer.rooms.request_id}`);

  // C. Old lead becomes regular member
  await supabase
    .from("room_members")
    .update({
      role: "member",
      can_edit_tasks: true,
      can_set_deadlines: false,
      can_invite_mentors: false,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", transfer.room_id)
    .eq("user_id", oldLeadId);

  // D. New lead becomes lead
  await supabase
    .from("room_members")
    .update({
      role: "lead",
      can_edit_tasks: true,
      can_set_deadlines: true,
      can_invite_mentors: true,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", transfer.room_id)
    .eq("user_id", newLeadId);

  // E. Mark transfer accepted
  await supabase.from("lead_transfers").update({ status: "accepted" }).eq("id", transferId);

  // F. Room event
  await supabase.from("room_events").insert({
    room_id: transfer.room_id,
    actor_id: user.id,
    event_type: "lead_swapped",
    metadata: {
      transfer_id: transferId,
      old_lead_id: oldLeadId,
      new_lead_id: newLeadId,
    },
  });

  // G. Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.lead_swapped",
    target: transfer.room_id,
    metadata: {
      old_lead_id: oldLeadId,
      new_lead_id: newLeadId,
      transfer_id: transferId,
    },
  });

  return { success: true, data: { status: "accepted", newLeadId } };
}

/**
 * 5. Remove Room Member (Lead Only)
 * Invariant 8: Removal needs a written reason (minimum length 10 characters) shown in the room's event feed.
 * Removed members lose access immediately; their messages and files remain with attribution.
 */
export async function removeMemberAction(
  roomId: string,
  targetUserId: string,
  reason: string,
): Promise<ActionResult<{ removed: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // 1. Validate written reason (minimum 10 chars)
  const validation = validateRemovalReason(reason);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Try atomic database stored procedure
  const { data: rpcRes, error: rpcError } = await supabase.rpc("remove_room_member", {
    p_room_id: roomId,
    p_lead_id: user.id,
    p_target_user_id: targetUserId,
    p_reason: validation.trimmedReason,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, data: { removed: true } };
  }

  // 3. Fallback transactional flow
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("lead_id")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Project room not found." };
  }

  if (room.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can remove members." };
  }

  if (targetUserId === user.id) {
    return { success: false, error: "The project lead cannot be removed. Transfer leadership first." };
  }

  // Update room member to removed
  const { error: updateError } = await supabase
    .from("room_members")
    .update({
      status: "removed",
      removed_reason: validation.trimmedReason,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .eq("status", "active");

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Post to room_events feed visible to all members
  await supabase.from("room_events").insert({
    room_id: roomId,
    actor_id: user.id,
    event_type: "member_removed",
    metadata: {
      target_user_id: targetUserId,
      reason: validation.trimmedReason,
    },
  });

  // Notify removed member
  await supabase.from("notifications").insert({
    user_id: targetUserId,
    type: "room_member_removed",
    title: "Removed from Project Room",
    body: `You were removed from the room: ${validation.trimmedReason.slice(0, 60)}...`,
    link: "/rooms",
  });

  // Audit log (IDs only)
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.member_removed",
    target: roomId,
    metadata: {
      target_user_id: targetUserId,
    },
  });

  return { success: true, data: { removed: true } };
}

/**
 * 6. Leave Room ("Delete room" for that member)
 * Invariant: Member's access ends, the room continues.
 */
export async function leaveRoomAction(
  roomId: string,
): Promise<ActionResult<{ left: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Try database stored procedure
  const { data: rpcRes, error: rpcError } = await supabase.rpc("leave_room", {
    p_room_id: roomId,
    p_user_id: user.id,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, data: { left: true } };
  }

  // Fallback
  const { data: room } = await supabase.from("rooms").select("lead_id").eq("id", roomId).single();
  if (room?.lead_id === user.id) {
    const { count } = await supabase
      .from("room_members")
      .select("id", { count: "exact" })
      .eq("room_id", roomId)
      .neq("user_id", user.id)
      .eq("status", "active")
      .neq("role", "mentor");

    if (count && count > 0) {
      return { success: false, error: "Project lead must transfer leadership to another member before leaving." };
    }
  }

  const { error: updateError } = await supabase
    .from("room_members")
    .update({ status: "left", updated_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  await supabase.from("room_events").insert({
    room_id: roomId,
    actor_id: user.id,
    event_type: "member_left",
    metadata: { user_id: user.id },
  });

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.member_left",
    target: roomId,
    metadata: { user_id: user.id },
  });

  return { success: true, data: { left: true } };
}

/**
 * 7. Re-add Member
 * Invariant: The lead can re-add only someone who previously accepted, and never a blocked user.
 */
export async function reAddMemberAction(
  roomId: string,
  targetUserId: string,
): Promise<ActionResult<{ readded: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // 1. Try database stored procedure
  const { data: rpcRes, error: rpcError } = await supabase.rpc("re_add_room_member", {
    p_room_id: roomId,
    p_actor_id: user.id,
    p_target_user_id: targetUserId,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, data: { readded: true } };
  }

  // 2. Fallback validation and restoration
  const { data: room } = await supabase.from("rooms").select("*, team_requests(id)").eq("id", roomId).single();
  if (!room) return { success: false, error: "Project room not found." };

  const { data: actorMember } = await supabase
    .from("room_members")
    .select("role, can_invite_mentors")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!actorMember || (room.lead_id !== user.id && !actorMember.can_invite_mentors)) {
    return { success: false, error: "Permission denied: must be lead or have re-add permission." };
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("is_blocked")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile || targetProfile.is_blocked) {
    return { success: false, error: "Blocked users cannot be re-added to any project room." };
  }

  // Check if target user previously accepted
  const { data: prevMember } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  const { data: acceptedApp } = await supabase
    .from("applications")
    .select("id")
    .or(`request_id.eq.${room.request_id}`)
    .eq("applicant_id", targetUserId)
    .eq("status", "accepted")
    .maybeSingle();

  const hadAccepted = Boolean(prevMember || acceptedApp);
  const eligibility = validateReAddEligibility(hadAccepted, targetProfile.is_blocked);
  if (!eligibility.valid) {
    return { success: false, error: eligibility.error };
  }

  await supabase
    .from("room_members")
    .upsert({
      room_id: roomId,
      user_id: targetUserId,
      role: "member",
      status: "active",
      removed_reason: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "room_id,user_id" });

  await supabase.from("room_events").insert({
    room_id: roomId,
    actor_id: user.id,
    event_type: "member_readded",
    metadata: { user_id: targetUserId, readded_by: user.id },
  });

  await supabase.from("notifications").insert({
    user_id: targetUserId,
    type: "room_member_readded",
    title: "Re-added to Project Room",
    body: "You have been re-added to your project room.",
    link: `/rooms/${roomId}`,
  });

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room.member_readded",
    target: roomId,
    metadata: { target_user_id: targetUserId },
  });

  return { success: true, data: { readded: true } };
}

/**
 * 8. Fetch Room Events Feed
 */
export async function getRoomEventsAction(
  roomId: string,
): Promise<ActionResult<RoomEventWithActor[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("room_events")
    .select("*, actor:actor_id(id, display_name, department)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as RoomEventWithActor[] };
}

/**
 * 9. Fetch Pending Lead Transfer for Current User / Room
 */
export async function getPendingLeadSwapAction(
  roomId: string,
): Promise<ActionResult<LeadTransfer | null>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("lead_transfers")
    .select("*")
    .eq("room_id", roomId)
    .in("status", ["applied", "selected"])
    .or(`current_lead_id.eq.${user.id},target_lead_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data as LeadTransfer) || null };
}

/**
 * 10. Fetch Candidates Eligible to be Re-Added (Past accepted members who left or were removed)
 */
export async function getRoomEligibleReAddCandidatesAction(
  roomId: string,
): Promise<ActionResult<Array<{ id: string; display_name: string; department: string; status: string; removed_reason: string | null }>>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("room_members")
    .select("user_id, status, removed_reason, profiles:user_id(id, display_name, department, is_blocked)")
    .eq("room_id", roomId)
    .in("status", ["left", "removed"]);

  if (error) {
    return { success: false, error: error.message };
  }

  const eligible = (data || [])
    .filter((m) => {
      const p = m.profiles as unknown as { is_blocked: boolean };
      return p && !p.is_blocked;
    })
    .map((m) => {
      const p = m.profiles as unknown as { id: string; display_name: string; department: string };
      return {
        id: p.id,
        display_name: p.display_name,
        department: p.department,
        status: m.status,
        removed_reason: m.removed_reason,
      };
    });

  return { success: true, data: eligible };
}
