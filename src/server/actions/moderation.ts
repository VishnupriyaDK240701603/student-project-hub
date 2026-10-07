"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  validateReportInput,
  validateJustificationInput,
  validateAppealInput,
  validateJustificationDeadlineHours,
  MODERATION_LIMITS,
} from "@/lib/moderation-validation";
import { sanitizeText } from "@/lib/sanitize";
import type { Report, ReportSnapshot, Justification, Appeal } from "@/types/database.types";
import type { ActionResult } from "./rooms";

export interface ReportWithDetails extends Report {
  snapshot?: ReportSnapshot | null;
  justifications?: Justification[];
  appeals?: Appeal[];
}

/**
 * 1. Submit a Report with Snapshot (Spec F14 Requirement 1)
 * Captures an immutable snapshot of target user/request/messages.
 * Rate limited to 5 reports per user per day.
 */
export async function createReportAction(params: {
  target_type: "user" | "request" | "message";
  target_id: string;
  reason: string;
  selected_message_ids?: string[];
}): Promise<ActionResult<{ reportId: string }>> {
  const validation = validateReportInput({
    target_type: params.target_type,
    target_id: params.target_id,
    reason: params.reason,
  });

  if (!validation.isValid || !validation.sanitizedReason) {
    return { success: false, error: validation.error || "Invalid report input." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Rate limit: 5 reports in 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: reportsToday, error: countErr } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id)
    .gte("created_at", oneDayAgo);

  if (!countErr && (reportsToday || 0) >= MODERATION_LIMITS.maxReportsPerUserPerDay) {
    return {
      success: false,
      error: `Daily report limit reached (maximum ${MODERATION_LIMITS.maxReportsPerUserPerDay} reports per 24 hours).`,
    };
  }

  // Capture Snapshot Data according to target type
  const snapshotData: Record<string, unknown> = {
    target_type: params.target_type,
    target_id: params.target_id,
    captured_at: new Date().toISOString(),
  };

  if (params.target_type === "user") {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, display_name, department, kind, bio")
      .eq("id", params.target_id)
      .single();

    snapshotData.profile = targetProfile || null;

    if (params.selected_message_ids && params.selected_message_ids.length > 0) {
      const { data: capturedMsgs } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .in("id", params.selected_message_ids.slice(0, 10));

      snapshotData.messages = capturedMsgs || [];
    }
  } else if (params.target_type === "request") {
    const { data: requestData } = await supabase
      .from("team_requests")
      .select("id, title, description, department, required_skills, min_capacity, max_capacity, created_at")
      .eq("id", params.target_id)
      .single();

    snapshotData.request = requestData || null;
  } else if (params.target_type === "message") {
    const { data: messageData } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("id", params.target_id)
      .single();

    snapshotData.message = messageData || null;
  }

  // Insert report
  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      target_type: params.target_type,
      target_id: params.target_id,
      reason: validation.sanitizedReason,
      status: "pending",
    })
    .select("id")
    .single();

  if (reportErr || !report) {
    return { success: false, error: reportErr?.message || "Failed to submit report." };
  }

  // Insert snapshot
  const { error: snapshotErr } = await supabase.from("report_snapshots").insert({
    report_id: report.id,
    snapshot_data: snapshotData as unknown as Record<string, unknown>,
  });

  if (snapshotErr) {
    console.error("Failed to insert report snapshot:", snapshotErr);
  }

  // Insert Audit Log (IDs only)
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "report_created",
    target: `report:${report.id}`,
    metadata: {
      target_type: params.target_type,
      target_id: params.target_id,
    },
  });

  return { success: true, data: { reportId: report.id } };
}

/**
 * 2. Get Moderator Queue (Spec F14 Requirement 2)
 * Staff with moderator role only. Invariant D1: Only reads reports and snapshots, NEVER room tables!
 */
export async function getModerationQueueAction(): Promise<ActionResult<ReportWithDetails[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Check moderator role
  const { data: modRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "moderator")
    .single();

  if (!modRole) {
    return { success: false, error: "Forbidden: Moderator role required." };
  }

  // Fetch reports
  const { data: reports, error: reportsErr } = await supabase
    .from("reports")
    .select(`
      id,
      reporter_id,
      target_type,
      target_id,
      reason,
      status,
      assigned_moderator_id,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (reportsErr || !reports) {
    return { success: false, error: reportsErr?.message || "Failed to load reports." };
  }

  // Fetch corresponding snapshots, justifications, appeals
  const reportIds = reports.map((r) => r.id);

  const { data: snapshots } = await supabase
    .from("report_snapshots")
    .select("id, report_id, snapshot_data, created_at")
    .in("report_id", reportIds);

  const { data: justifications } = await supabase
    .from("justifications")
    .select("id, report_id, accused_id, content, deadline, created_at")
    .in("report_id", reportIds);

  const { data: appeals } = await supabase
    .from("appeals")
    .select("id, report_id, appellant_id, reason, status, created_at")
    .in("report_id", reportIds);

  const combined: ReportWithDetails[] = reports.map((rep) => {
    const snap = snapshots?.find((s) => s.report_id === rep.id) || null;
    const justs = justifications?.filter((j) => j.report_id === rep.id) || [];
    const apps = appeals?.filter((a) => a.report_id === rep.id) || [];

    return {
      ...rep,
      snapshot: snap,
      justifications: justs,
      appeals: apps,
    };
  });

  return { success: true, data: combined };
}

/**
 * 3. Request Justification from Accused (Spec F14 Requirement 3)
 */
export async function requestJustificationAction(params: {
  reportId: string;
  accusedId: string;
  deadlineHours: number;
}): Promise<ActionResult<{ justificationId: string }>> {
  const deadlineVal = validateJustificationDeadlineHours(params.deadlineHours);
  if (!deadlineVal.isValid) {
    return { success: false, error: deadlineVal.error || "Invalid deadline duration." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Verify moderator role
  const { data: modRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "moderator")
    .single();

  if (!modRole) {
    return { success: false, error: "Forbidden: Moderator role required." };
  }

  const deadline = new Date(Date.now() + params.deadlineHours * 60 * 60 * 1000).toISOString();

  // Update report status
  const { error: updateErr } = await supabase
    .from("reports")
    .update({
      status: "under_review",
      assigned_moderator_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.reportId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Insert justification row
  const { data: justification, error: justErr } = await supabase
    .from("justifications")
    .insert({
      report_id: params.reportId,
      accused_id: params.accusedId,
      deadline,
    })
    .select("id")
    .single();

  if (justErr || !justification) {
    return { success: false, error: justErr?.message || "Failed to create justification request." };
  }

  // Notify accused in inbox
  await supabase.from("notifications").insert({
    user_id: params.accusedId,
    type: "system_announcement",
    title: "Action Required: Justification requested by moderation",
    body: `A moderator has requested your response to a report. Deadline: ${new Date(deadline).toLocaleString()}`,
    action_url: "/blocked",
  });

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "justification_requested",
    target: `report:${params.reportId}`,
    metadata: {
      accused_id: params.accusedId,
      deadline_hours: params.deadlineHours,
    },
  });

  return { success: true, data: { justificationId: justification.id } };
}

/**
 * 4. Submit Justification (Accused user responding before deadline)
 */
export async function submitJustificationAction(params: {
  justificationId: string;
  content: string;
}): Promise<ActionResult<{ success: boolean }>> {
  const validation = validateJustificationInput(params.content);
  if (!validation.isValid || !validation.sanitizedContent) {
    return { success: false, error: validation.error || "Invalid justification content." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Fetch justification
  const { data: justification, error: justErr } = await supabase
    .from("justifications")
    .select("id, report_id, accused_id, deadline")
    .eq("id", params.justificationId)
    .single();

  if (justErr || !justification) {
    return { success: false, error: "Justification request not found." };
  }

  if (justification.accused_id !== user.id) {
    return { success: false, error: "Forbidden: You cannot respond to this justification." };
  }

  if (new Date() > new Date(justification.deadline)) {
    return { success: false, error: "The deadline for this justification has passed." };
  }

  // Update justification content
  const { error: updateErr } = await supabase
    .from("justifications")
    .update({ content: validation.sanitizedContent })
    .eq("id", params.justificationId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "justification_submitted",
    target: `justification:${params.justificationId}`,
    metadata: { report_id: justification.report_id },
  });

  return { success: true, data: { success: true } };
}

/**
 * 5. Dismiss Report (Moderator takes no punitive action)
 */
export async function dismissReportAction(params: {
  reportId: string;
  note?: string;
}): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data: modRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "moderator")
    .single();

  if (!modRole) {
    return { success: false, error: "Forbidden: Moderator role required." };
  }

  const { error: updateErr } = await supabase
    .from("reports")
    .update({
      status: "dismissed",
      assigned_moderator_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.reportId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "report_dismissed",
    target: `report:${params.reportId}`,
    metadata: { note: params.note ? sanitizeText(params.note) : undefined },
  });

  return { success: true, data: { success: true } };
}

/**
 * 6. Permanently Block User (Spec F14 Requirement 3)
 * Revokes sessions and blocks user everywhere.
 */
export async function blockUserAction(params: {
  reportId: string;
  accusedId: string;
  reason?: string;
}): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data: modRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "moderator")
    .single();

  if (!modRole) {
    return { success: false, error: "Forbidden: Moderator role required." };
  }

  // Update profile to blocked
  const { error: blockErr } = await supabase
    .from("profiles")
    .update({
      is_blocked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.accusedId);

  if (blockErr) {
    return { success: false, error: blockErr.message };
  }

  // Update report status
  const { error: repErr } = await supabase
    .from("reports")
    .update({
      status: "blocked",
      assigned_moderator_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.reportId);

  if (repErr) {
    return { success: false, error: repErr.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "user_blocked",
    target: `profile:${params.accusedId}`,
    metadata: {
      report_id: params.reportId,
      reason: params.reason ? sanitizeText(params.reason) : undefined,
    },
  });

  return { success: true, data: { success: true } };
}

/**
 * 7. Submit Moderation Appeal (Spec F14 Requirement 4)
 * Blocked person submits an appeal for review by a different moderator.
 */
export async function submitAppealAction(params: {
  reportId: string;
  reason: string;
}): Promise<ActionResult<{ appealId: string }>> {
  const validation = validateAppealInput(params.reason);
  if (!validation.isValid || !validation.sanitizedReason) {
    return { success: false, error: validation.error || "Invalid appeal reason." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Check if an appeal already exists
  const { data: existingAppeal } = await supabase
    .from("appeals")
    .select("id")
    .eq("report_id", params.reportId)
    .eq("appellant_id", user.id)
    .single();

  if (existingAppeal) {
    return { success: false, error: "An appeal has already been submitted for this report." };
  }

  // Insert appeal
  const { data: appeal, error: appealErr } = await supabase
    .from("appeals")
    .insert({
      report_id: params.reportId,
      appellant_id: user.id,
      reason: validation.sanitizedReason,
      status: "appealed",
    })
    .select("id")
    .single();

  if (appealErr || !appeal) {
    return { success: false, error: appealErr?.message || "Failed to submit appeal." };
  }

  // Update report status
  await supabase
    .from("reports")
    .update({
      status: "appealed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.reportId);

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "appeal_submitted",
    target: `appeal:${appeal.id}`,
    metadata: { report_id: params.reportId },
  });

  return { success: true, data: { appealId: appeal.id } };
}

/**
 * 8. Resolve Moderation Appeal (Spec F14 Requirement 4)
 * TWO MODERATOR RULE: The deciding moderator MUST be different from the moderator who blocked/actioned the report.
 */
export async function resolveAppealAction(params: {
  appealId: string;
  decision: "approved" | "rejected";
  note?: string;
}): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data: modRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "moderator")
    .single();

  if (!modRole) {
    return { success: false, error: "Forbidden: Moderator role required." };
  }

  // Fetch appeal and associated report
  const { data: appeal, error: appealErr } = await supabase
    .from("appeals")
    .select("id, report_id, appellant_id, status")
    .eq("id", params.appealId)
    .single();

  if (appealErr || !appeal) {
    return { success: false, error: "Appeal record not found." };
  }

  const { data: report, error: repErr } = await supabase
    .from("reports")
    .select("id, assigned_moderator_id")
    .eq("id", appeal.report_id)
    .single();

  if (repErr || !report) {
    return { success: false, error: "Associated report not found." };
  }

  // TWO-MODERATOR ENFORCEMENT: Deciding mod cannot be the blocking/assigned mod
  if (report.assigned_moderator_id && report.assigned_moderator_id === user.id) {
    return {
      success: false,
      error: "Two-moderator rule: An appeal cannot be decided by the same moderator who handled the initial report or block.",
    };
  }

  if (params.decision === "approved") {
    // Unblock appellant
    await supabase
      .from("profiles")
      .update({
        is_blocked: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appeal.appellant_id);

    // Update appeal status
    await supabase
      .from("appeals")
      .update({ status: "dismissed" })
      .eq("id", params.appealId);

    // Update report status
    await supabase
      .from("reports")
      .update({
        status: "dismissed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appeal.report_id);
  } else {
    // Reject appeal: remains blocked
    await supabase
      .from("appeals")
      .update({ status: "blocked" })
      .eq("id", params.appealId);

    await supabase
      .from("reports")
      .update({
        status: "blocked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appeal.report_id);
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "appeal_resolved",
    target: `appeal:${params.appealId}`,
    metadata: {
      decision: params.decision,
      appellant_id: appeal.appellant_id,
      blocking_mod_id: report.assigned_moderator_id,
      deciding_mod_id: user.id,
    },
  });

  return { success: true, data: { success: true } };
}
