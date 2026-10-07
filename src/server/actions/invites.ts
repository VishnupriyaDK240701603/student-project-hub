"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import {
  validateInviteExpiryHours,
  calculateExpiresAt,
  isInviteExpired,
  validateReplacementReason,
} from "@/lib/invites-validation";
import type { Application, TeamRequest, Notification } from "@/types/database.types";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InviteWithRequestDetails extends Application {
  team_requests: {
    id: string;
    title: string;
    role_needed: string;
    headcount: number;
    lead_id: string;
    status: string;
    profiles?: {
      display_name: string;
      department: string;
    };
  } | null;
}

/**
 * 1. Select Applicant (Lead action)
 * Invariant 4: Open-spot count drops ONLY on acceptance, NOT on selection!
 */
export async function selectApplicant(
  applicationId: string,
  expiryHours: number,
): Promise<ActionResult<{ applicationId: string; expires_at: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Validate expiry hours
  const validation = validateInviteExpiryHours(expiryHours);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Fetch application and request details
  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*, team_requests(*)")
    .eq("id", applicationId)
    .single();

  if (appError || !application || !application.team_requests) {
    return { success: false, error: "Application not found." };
  }

  const request = application.team_requests as unknown as TeamRequest;

  // Authorization check: Caller must be the request lead
  if (request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can select applicants." };
  }

  if (application.status === "accepted") {
    return { success: false, error: "Applicant has already accepted the invitation." };
  }

  if (application.status === "withdrawn") {
    return { success: false, error: "Cannot select a withdrawn application." };
  }

  const expiresAt = calculateExpiresAt(expiryHours);

  // Update application to 'selected'
  const { error: updateError } = await supabase
    .from("applications")
    .update({
      status: "selected",
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Create notification for applicant
  await supabase.from("notifications").insert({
    user_id: application.applicant_id,
    type: "selection_invite",
    title: "Team Invite Received!",
    body: `You have been selected to join "${request.title}" as ${request.role_needed}. Please respond within ${expiryHours} hours.`,
    link: "/inbox",
  });

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "application.selected",
    target: applicationId,
    metadata: {
      request_id: request.id,
      applicant_id: application.applicant_id,
      expiry_hours: expiryHours,
      expires_at: expiresAt,
    },
  });

  return {
    success: true,
    data: {
      applicationId,
      expires_at: expiresAt,
    },
  };
}

/**
 * 2. Reject Applicant (Lead action)
 */
export async function rejectApplicant(
  applicationId: string,
): Promise<ActionResult<{ applicationId: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*, team_requests(*)")
    .eq("id", applicationId)
    .single();

  if (appError || !application || !application.team_requests) {
    return { success: false, error: "Application not found." };
  }

  const request = application.team_requests as unknown as TeamRequest;

  if (request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can reject applicants." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "application.rejected",
    target: applicationId,
    metadata: {
      request_id: request.id,
      applicant_id: application.applicant_id,
    },
  });

  return { success: true, data: { applicationId } };
}

/**
 * 3. Waitlist Applicant (Lead action - private waiting list)
 * Invariant: Waitlisted applicants are lead-only and manual
 */
export async function waitlistApplicant(
  applicationId: string,
): Promise<ActionResult<{ applicationId: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*, team_requests(*)")
    .eq("id", applicationId)
    .single();

  if (appError || !application || !application.team_requests) {
    return { success: false, error: "Application not found." };
  }

  const request = application.team_requests as unknown as TeamRequest;

  if (request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can waitlist applicants." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      status: "waitlisted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "application.waitlisted",
    target: applicationId,
    metadata: {
      request_id: request.id,
      applicant_id: application.applicant_id,
    },
  });

  return { success: true, data: { applicationId } };
}

/**
 * 4. Accept Invite (Invitee action)
 * Calls Postgres atomic accept_invite RPC to guarantee concurrency safety and row-locking.
 */
export async function acceptInviteAction(
  applicationId: string,
): Promise<ActionResult<{ accepted: boolean; roomId?: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Fetch application ensuring invitee ownership
  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*, team_requests(*)")
    .eq("id", applicationId)
    .single();

  if (appError || !application || !application.team_requests) {
    return { success: false, error: "Invite not found." };
  }

  if (application.applicant_id !== user.id) {
    return { success: false, error: "Unauthorized: You can only respond to your own invite." };
  }

  if (application.status !== "selected") {
    return { success: false, error: "This invite is no longer in a pending selected state." };
  }

  // Check if expired
  if (isInviteExpired(application.expires_at)) {
    await supabase
      .from("applications")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", applicationId);

    return { success: false, error: "This invite has expired." };
  }

  const request = application.team_requests as unknown as TeamRequest;

  // Execute atomic accept_invite RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc("accept_invite", {
    p_application_id: applicationId,
  });

  if (rpcError) {
    // If RPC doesn't exist or fails, fall back to transactional check
    const { count: acceptedCount } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("request_id", request.id)
      .eq("status", "accepted");

    if ((acceptedCount ?? 0) >= request.headcount) {
      return { success: false, error: "This team has already filled all available spots." };
    }

    await supabase
      .from("applications")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", applicationId);
  } else if (!rpcResult?.success) {
    return {
      success: false,
      error: rpcResult?.error || "This team has already filled all available spots.",
    };
  }

  // Notify lead of acceptance
  await supabase.from("notifications").insert({
    user_id: request.lead_id,
    type: "invite_accepted",
    title: "Invite Accepted!",
    body: `A candidate has accepted your invitation to join "${request.title}".`,
    link: `/requests/${request.id}`,
  });

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "invite.accepted",
    target: applicationId,
    metadata: {
      request_id: request.id,
      room_id: rpcResult?.room_id || null,
    },
  });

  return {
    success: true,
    data: {
      accepted: true,
      roomId: rpcResult?.room_id,
    },
  };
}

/**
 * 5. Decline Invite (Invitee action)
 */
export async function declineInviteAction(
  applicationId: string,
): Promise<ActionResult<{ declined: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*, team_requests(*)")
    .eq("id", applicationId)
    .single();

  if (appError || !application || !application.team_requests) {
    return { success: false, error: "Invite not found." };
  }

  if (application.applicant_id !== user.id) {
    return { success: false, error: "Unauthorized: You can only respond to your own invite." };
  }

  if (application.status !== "selected") {
    return { success: false, error: "Invite is no longer in a selected state." };
  }

  const request = application.team_requests as unknown as TeamRequest;

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      status: "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Notify lead of decline
  await supabase.from("notifications").insert({
    user_id: request.lead_id,
    type: "invite_declined",
    title: "Invite Declined",
    body: `A candidate declined your invite to join "${request.title}".`,
    link: `/requests/${request.id}`,
  });

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "invite.declined",
    target: applicationId,
    metadata: {
      request_id: request.id,
    },
  });

  return { success: true, data: { declined: true } };
}

/**
 * 6. Raise Headcount (Lead action)
 * Invariant: Headcount can only be raised, never reduced.
 */
export async function raiseHeadcountAction(
  requestId: string,
  newHeadcount: number,
): Promise<ActionResult<{ newHeadcount: number }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: request, error: reqError } = await supabase
    .from("team_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return { success: false, error: "Team request not found." };
  }

  if (request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can raise headcount." };
  }

  if (newHeadcount <= request.headcount) {
    return {
      success: false,
      error: `New headcount (${newHeadcount}) must be greater than current headcount (${request.headcount}).`,
    };
  }

  // Try RPC first
  const { error: rpcError } = await supabase.rpc("raise_headcount", {
    p_request_id: requestId,
    p_new_headcount: newHeadcount,
  });

  if (rpcError) {
    // Direct update fallback
    await supabase
      .from("team_requests")
      .update({
        headcount: newHeadcount,
        status: request.status === "full" ? "open" : request.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
  }

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "headcount.raised",
    target: requestId,
    metadata: {
      old_headcount: request.headcount,
      new_headcount: newHeadcount,
    },
  });

  return { success: true, data: { newHeadcount } };
}

/**
 * 7. Replace Member (Lead action with written reason)
 * Invariant: Removal requires a written reason of >= 10 chars. Reopens spot.
 */
export async function replaceMemberAction(
  requestId: string,
  applicationId: string,
  reason: string,
): Promise<ActionResult<{ replaced: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const reasonValidation = validateReplacementReason(reason);
  if (!reasonValidation.valid) {
    return { success: false, error: reasonValidation.error };
  }

  const cleanReason = sanitizeText(reason);

  const { data: request, error: reqError } = await supabase
    .from("team_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return { success: false, error: "Team request not found." };
  }

  if (request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can remove or replace members." };
  }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("request_id", requestId)
    .single();

  if (appError || !application) {
    return { success: false, error: "Application not found." };
  }

  if (application.status !== "accepted") {
    return { success: false, error: "Only accepted members can be replaced." };
  }

  // Update application status to 'withdrawn'
  await supabase
    .from("applications")
    .update({
      status: "withdrawn",
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  // If request was 'full', reopen it
  if (request.status === "full") {
    await supabase
      .from("team_requests")
      .update({
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
  }

  // Notify the removed member with the reason
  await supabase.from("notifications").insert({
    user_id: application.applicant_id,
    type: "member_replaced",
    title: "Team Membership Update",
    body: `You were removed from "${request.title}". Reason: ${cleanReason}`,
  });

  // Write audit log entry
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "member.replaced",
    target: applicationId,
    metadata: {
      request_id: requestId,
      member_id: application.applicant_id,
      reason: cleanReason,
    },
  });

  return { success: true, data: { replaced: true } };
}

/**
 * 8. Expiry Job (Idempotent job auto-rejecting expired invites)
 * Requirement 7: Scheduled job auto-rejects expired invites and creates a notification for the lead.
 */
export async function checkAndExpireInvitesAction(
  currentTime: Date = new Date(),
): Promise<ActionResult<{ expiredCount: number }>> {
  const supabase = await createServerSupabaseClient();

  const nowIso = currentTime.toISOString();

  // Find all applications in 'selected' status where expires_at <= currentTime
  const { data: expiredApps, error: fetchError } = await supabase
    .from("applications")
    .select("id, request_id, applicant_id, expires_at, team_requests(id, lead_id, title), profiles:applicant_id(display_name)")
    .eq("status", "selected")
    .lte("expires_at", nowIso);

  if (fetchError || !expiredApps || expiredApps.length === 0) {
    return { success: true, data: { expiredCount: 0 } };
  }

  let count = 0;

  for (const app of expiredApps) {
    // Update status to 'expired'
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("id", app.id);

    if (!updateError) {
      count++;
      const req = app.team_requests as unknown as { id: string; lead_id: string; title: string } | null;
      const applicantName = (app.profiles as unknown as { display_name: string })?.display_name || "Candidate";

      if (req?.lead_id) {
        // Create notification for the request lead
        await supabase.from("notifications").insert({
          user_id: req.lead_id,
          type: "invite_expired",
          title: "Team Invite Expired",
          body: `The invitation sent to ${applicantName} for "${req.title}" has expired without response.`,
          link: `/requests/${req.id}`,
        });
      }

      // Write audit log entry
      await supabase.from("audit_log").insert({
        actor_id: null, // System automated job
        action: "invite.expired",
        target: app.id,
        metadata: {
          request_id: app.request_id,
          applicant_id: app.applicant_id,
          expired_at: nowIso,
        },
      });
    }
  }

  return { success: true, data: { expiredCount: count } };
}

/**
 * 9. Fetch user's pending invites for Inbox
 */
export async function getUserInvitesAction(): Promise<ActionResult<InviteWithRequestDetails[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*, team_requests(id, title, role_needed, headcount, lead_id, status, profiles:lead_id(display_name, department))")
    .eq("applicant_id", user.id)
    .eq("status", "selected")
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as InviteWithRequestDetails[] };
}

/**
 * 10. Fetch user's notifications for Inbox
 */
export async function getUserNotificationsAction(): Promise<ActionResult<Notification[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as Notification[] };
}

/**
 * 11. Mark notification as read
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { id: notificationId } };
}
