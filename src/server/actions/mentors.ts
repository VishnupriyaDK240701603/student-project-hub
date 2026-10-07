"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import {
  validateMentorInviteInput,
  validateStaffPendingLimit,
  isMentorInviteExpired,
} from "@/lib/mentor-validation";
import { dispatchNotificationEmail } from "@/lib/notifications/email-service";
import { createSafePushPayload, sendWebPushNotification } from "@/lib/notifications/push-service";
import type { MentorInvite, Profile, TeamRequest } from "@/types/database.types";
import type { ActionResult } from "./rooms";

export interface StaffSearchResult {
  id: string;
  display_name: string;
  department: string;
  email: string;
  pendingInviteCount: number;
}

export interface MentorInviteWithDetails extends MentorInvite {
  team_requests: (TeamRequest & { profiles?: Profile | null }) | null;
  inviter: {
    id: string;
    display_name: string;
    department: string;
  } | null;
}

/**
 * 1. Search Staff Members by Name or Department (Spec F12 Requirement 1)
 */
export async function searchStaffAction(
  query: string = "",
  department?: string,
): Promise<ActionResult<StaffSearchResult[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  let dbQuery = supabase
    .from("profiles")
    .select("id, display_name, department, email")
    .eq("kind", "staff")
    .eq("is_blocked", false)
    .eq("is_deactivated", false)
    .limit(15);

  const cleanQuery = sanitizeText(query.trim());
  if (cleanQuery.length > 0) {
    dbQuery = dbQuery.ilike("display_name", `%${cleanQuery}%`);
  }

  if (department && department !== "all") {
    dbQuery = dbQuery.eq("department", department);
  }

  const { data: staffList, error } = await dbQuery;
  if (error) {
    return { success: false, error: error.message };
  }

  if (!staffList || staffList.length === 0) {
    return { success: true, data: [] };
  }

  // Count pending invites for each staff member to inform inviter
  const staffIds = staffList.map((s) => s.id);
  const nowIso = new Date().toISOString();
  const { data: pendingInvites } = await supabase
    .from("mentor_invites")
    .select("staff_id")
    .in("staff_id", staffIds)
    .eq("status", "selected")
    .gt("expires_at", nowIso);

  const pendingCountMap: Record<string, number> = {};
  (pendingInvites || []).forEach((pi) => {
    pendingCountMap[pi.staff_id] = (pendingCountMap[pi.staff_id] || 0) + 1;
  });

  const results: StaffSearchResult[] = staffList.map((s) => ({
    id: s.id,
    display_name: s.display_name,
    department: s.department,
    email: s.email,
    pendingInviteCount: pendingCountMap[s.id] || 0,
  }));

  return { success: true, data: results };
}

/**
 * 2. Invite Staff Mentor (Spec F12, Invariant 4, APP_LIMITS: max 10 pending invites)
 */
export async function inviteStaffMentorAction(input: {
  roomId: string;
  staffId: string;
  expiryHours: number;
  note?: string;
}): Promise<ActionResult<{ inviteId: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const validation = validateMentorInviteInput(input);
  if (!validation.valid || !validation.calculatedExpiresAt) {
    return { success: false, error: validation.error };
  }

  // 1. Verify caller has permission in room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*, team_requests(id, title)")
    .eq("id", input.roomId)
    .single();

  if (roomError || !room) {
    return { success: false, error: "Project room not found." };
  }

  if (room.lead_id !== user.id) {
    const { data: member } = await supabase
      .from("room_members")
      .select("can_invite_mentors, status")
      .eq("room_id", input.roomId)
      .eq("user_id", user.id)
      .single();

    if (!member || member.status !== "active" || !member.can_invite_mentors) {
      return { success: false, error: "Permission denied: only the team lead or members with invite permission can invite mentors." };
    }
  }

  // 2. Verify target staff member exists and is staff
  const { data: staffProfile, error: staffError } = await supabase
    .from("profiles")
    .select("id, display_name, email, kind, is_blocked, is_deactivated")
    .eq("id", input.staffId)
    .single();

  if (staffError || !staffProfile || staffProfile.kind !== "staff") {
    return { success: false, error: "Target user is not a valid staff member." };
  }

  if (staffProfile.is_blocked || staffProfile.is_deactivated) {
    return { success: false, error: "This staff member is currently inactive or restricted." };
  }

  // 3. Enforce maximum 10 pending mentor invites limit
  const nowIso = new Date().toISOString();
  const { count: pendingCount, error: countError } = await supabase
    .from("mentor_invites")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", input.staffId)
    .eq("status", "selected")
    .gt("expires_at", nowIso);

  if (countError) {
    return { success: false, error: "Failed to verify staff pending invitations count." };
  }

  const limitCheck = validateStaffPendingLimit(pendingCount || 0);
  if (!limitCheck.valid) {
    return { success: false, error: limitCheck.error };
  }

  // 4. Invoke atomic stored procedure
  const { data: rpcRes, error: rpcError } = await supabase.rpc("invite_staff_mentor", {
    p_room_id: input.roomId,
    p_inviter_id: user.id,
    p_staff_id: input.staffId,
    p_expires_at: validation.calculatedExpiresAt,
    p_note: input.note ? sanitizeText(input.note) : null,
  });

  let inviteId: string;
  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; invite_id?: string; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    inviteId = res.invite_id!;
  } else {
    // Fallback transactional insert
    const { data: newInvite, error: insertError } = await supabase
      .from("mentor_invites")
      .insert({
        request_id: room.request_id,
        room_id: input.roomId,
        staff_id: input.staffId,
        invited_by: user.id,
        status: "selected",
        expires_at: validation.calculatedExpiresAt,
        note: input.note ? sanitizeText(input.note) : null,
      })
      .select("id")
      .single();

    if (insertError || !newInvite) {
      return { success: false, error: insertError?.message || "Failed to create mentor invitation." };
    }
    inviteId = newInvite.id;

    // Send in-app notification to staff member
    await supabase.from("notifications").insert({
      user_id: input.staffId,
      type: "mentor_invite_received",
      title: "New Project Mentor Invitation",
      body: `You have been invited to mentor "${room.team_requests?.title || "Project Room"}". Review in your Mentor Console.`,
      link: "/staff/mentor-inbox",
    });

    // Write audit log
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "mentor.invite_sent",
      target: input.roomId,
      metadata: {
        invite_id: inviteId,
        staff_id: input.staffId,
      },
    });
  }

  // 5. Invariant 11: Transactional Email via Resend
  // Outside production, email is safely restricted to EMAIL_TEST_RECIPIENT
  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const projectTitle = room.team_requests?.title || "Project Team";
  const inviterName = inviterProfile?.display_name || "Team Lead";

  await dispatchNotificationEmail({
    eventId: `mentor-invite-${inviteId}-${Date.now()}`,
    eventType: "mentor_invite",
    recipientEmail: staffProfile.email,
    recipientName: staffProfile.display_name,
    projectTitle,
    roleOrLead: inviterName,
    expiryHours: input.expiryHours,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/staff/mentor-inbox`,
  });

  // 6. Web Push if staff has active subscription
  const { data: sub } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", input.staffId)
    .maybeSingle();

  if (sub) {
    const safePayload = createSafePushPayload("Faculty Mentor Invitation", "/staff/mentor-inbox");
    await sendWebPushNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
      safePayload,
    );
  }

  return { success: true, data: { inviteId } };
}

/**
 * 3. Fetch Staff Mentor Invites (For Staff Console /staff/mentor-inbox)
 */
export async function getStaffMentorInvitesAction(
  statusFilter: "pending" | "accepted" | "rejected" | "expired" | "all" = "pending",
): Promise<ActionResult<MentorInviteWithDetails[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Verify caller is staff
  const { data: profile } = await supabase
    .from("profiles")
    .select("kind")
    .eq("id", user.id)
    .single();

  if (profile?.kind !== "staff") {
    return { success: false, error: "Access restricted: Staff console is only for faculty/staff." };
  }

  let query = supabase
    .from("mentor_invites")
    .select(
      "*, team_requests(*, profiles:lead_id(display_name, department)), inviter:invited_by(id, display_name, department)",
    )
    .eq("staff_id", user.id)
    .order("created_at", { ascending: false });

  if (statusFilter === "pending") {
    const nowIso = new Date().toISOString();
    query = query.eq("status", "selected").gt("expires_at", nowIso);
  } else if (statusFilter === "accepted") {
    query = query.eq("status", "accepted");
  } else if (statusFilter === "rejected") {
    query = query.eq("status", "rejected");
  } else if (statusFilter === "expired") {
    query = query.eq("status", "expired");
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as MentorInviteWithDetails[] };
}

/**
 * 4. Respond to Mentor Invite (Staff member accepts or declines)
 */
export async function respondToMentorInviteAction(
  inviteId: string,
  accept: boolean,
): Promise<ActionResult<{ status: string; roomId?: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // 1. Try atomic database stored procedure
  const { data: rpcRes, error: rpcError } = await supabase.rpc("respond_to_mentor_invite", {
    p_invite_id: inviteId,
    p_staff_id: user.id,
    p_accept: accept,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; status?: string; room_id?: string; error?: string };
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return { success: true, data: { status: res.status || (accept ? "accepted" : "rejected"), roomId: res.room_id } };
  }

  // 2. Transactional fallback
  const { data: invite, error: fetchError } = await supabase
    .from("mentor_invites")
    .select("*, team_requests(id, title)")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return { success: false, error: "Mentor invitation not found." };
  }

  if (invite.staff_id !== user.id) {
    return { success: false, error: "Unauthorized: This invitation is not addressed to you." };
  }

  if (invite.status !== "selected") {
    return { success: false, error: `This invitation is no longer pending (status: ${invite.status}).` };
  }

  if (isMentorInviteExpired(invite.expires_at)) {
    await supabase.from("mentor_invites").update({ status: "expired" }).eq("id", inviteId);
    return { success: false, error: "This invitation has expired." };
  }

  let roomId = invite.room_id;
  if (!roomId) {
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("request_id", invite.request_id)
      .maybeSingle();
    roomId = room?.id || null;
  }

  if (!accept) {
    await supabase.from("mentor_invites").update({ status: "rejected" }).eq("id", inviteId);

    // Notify inviter
    await supabase.from("notifications").insert({
      user_id: invite.invited_by,
      type: "mentor_invite_declined",
      title: "Mentor Invite Declined",
      body: "The faculty member declined your invitation to mentor the project team.",
      link: roomId ? `/rooms/${roomId}` : "/rooms",
    });

    return { success: true, data: { status: "rejected" } };
  }

  // Accepted flow
  await supabase.from("mentor_invites").update({ status: "accepted" }).eq("id", inviteId);

  if (roomId) {
    // Add to room_members as role = 'mentor' with active status
    await supabase.from("room_members").upsert(
      {
        room_id: roomId,
        user_id: user.id,
        role: "mentor",
        status: "active",
        can_edit_tasks: false,
        can_set_deadlines: false,
        can_invite_mentors: false,
      },
      { onConflict: "room_id,user_id" },
    );

    // Post to room_events
    await supabase.from("room_events").insert({
      room_id: roomId,
      actor_id: user.id,
      event_type: "mentor_joined",
      metadata: { staff_id: user.id },
    });

    // Notify team members
    await supabase.from("notifications").insert({
      user_id: invite.invited_by,
      type: "mentor_joined_team",
      title: "Staff Mentor Joined Room!",
      body: "A staff mentor has accepted your invitation and joined your project room.",
      link: `/rooms/${roomId}`,
    });
  }

  return { success: true, data: { status: "accepted", roomId: roomId || undefined } };
}

/**
 * 5. Expire Stale Mentor Invites (Scheduled Job / Callable Action)
 * Invariant 4: Selection invites and mentor invites auto-reject after expiry. Time-travel testable.
 */
export async function expireStaleMentorInvitesAction(
  currentTime: Date = new Date(),
): Promise<ActionResult<{ expiredCount: number; expiredIds: string[] }>> {
  const supabase = await createServerSupabaseClient();
  const currentIso = currentTime.toISOString();

  // Try RPC
  const { data: rpcRes, error: rpcError } = await supabase.rpc("expire_stale_mentor_invites", {
    p_current_time: currentIso,
  });

  if (!rpcError && rpcRes) {
    const res = rpcRes as { success: boolean; expired_count?: number; expired_ids?: string[] };
    return {
      success: true,
      data: {
        expiredCount: res.expired_count || 0,
        expiredIds: res.expired_ids || [],
      },
    };
  }

  // Fallback
  const { data: expiredList } = await supabase
    .from("mentor_invites")
    .select("id, invited_by, room_id")
    .eq("status", "selected")
    .lte("expires_at", currentIso);

  if (!expiredList || expiredList.length === 0) {
    return { success: true, data: { expiredCount: 0, expiredIds: [] } };
  }

  const ids = expiredList.map((i) => i.id);
  await supabase.from("mentor_invites").update({ status: "expired" }).in("id", ids);

  for (const inv of expiredList) {
    await supabase.from("notifications").insert({
      user_id: inv.invited_by,
      type: "mentor_invite_expired",
      title: "Mentor Invitation Expired",
      body: "A faculty mentor invitation expired without response.",
      link: inv.room_id ? `/rooms/${inv.room_id}` : "/rooms",
    });
  }

  return {
    success: true,
    data: {
      expiredCount: ids.length,
      expiredIds: ids,
    },
  };
}

/**
 * 6. Get Staff Pending Invites Count (For Header Badge on Staff Console)
 */
export async function getStaffPendingInvitesCountAction(): Promise<ActionResult<number>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from("mentor_invites")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", user.id)
    .eq("status", "selected")
    .gt("expires_at", nowIso);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: count || 0 };
}
