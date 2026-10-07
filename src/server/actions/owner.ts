"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import type { AuditLog } from "@/types/database.types";
import type { ActionResult } from "./rooms";

export interface ModeratorProfile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  department: string;
  created_at: string;
}

export interface OwnerDashboardData {
  moderators: ModeratorProfile[];
  auditLogs: AuditLog[];
  canRemoveModerator: boolean;
}

/**
 * 1. Fetch Owner Dashboard Data (Spec F14 Requirement 5)
 * Reads moderator assignments and audit log summary. Invariant D1: Cannot read rooms!
 */
export async function getOwnerDataAction(): Promise<ActionResult<OwnerDashboardData>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Verify Owner Role
  const { data: ownerRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .single();

  if (!ownerRole) {
    return { success: false, error: "Forbidden: Owner role required." };
  }

  // Fetch moderator roles
  const { data: modRoles, error: modErr } = await supabase
    .from("app_roles")
    .select("id, user_id, created_at")
    .eq("role", "moderator");

  if (modErr) {
    return { success: false, error: modErr.message };
  }

  const modUserIds = (modRoles || []).map((r) => r.user_id);

  let moderators: ModeratorProfile[] = [];
  if (modUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email, department")
      .in("id", modUserIds);

    moderators = (modRoles || []).map((role) => {
      const prof = profiles?.find((p) => p.id === role.user_id);
      return {
        id: role.id,
        user_id: role.user_id,
        display_name: prof?.display_name || "Unknown Staff",
        email: prof?.email || "Unknown Email",
        department: prof?.department || "Unassigned",
        created_at: role.created_at,
      };
    });
  }

  // Fetch read-only audit log summary (latest 100 entries)
  const { data: auditLogs, error: auditErr } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, target, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (auditErr) {
    return { success: false, error: auditErr.message };
  }

  return {
    success: true,
    data: {
      moderators,
      auditLogs: auditLogs || [],
      canRemoveModerator: moderators.length > 2,
    },
  };
}

/**
 * 2. Add Moderator by Email (Staff Only)
 */
export async function addModeratorAction(
  email: string,
): Promise<ActionResult<{ success: boolean }>> {
  const cleanEmail = sanitizeText(email.trim().toLowerCase());
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please provide a valid email address." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Verify Owner Role
  const { data: ownerRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .single();

  if (!ownerRole) {
    return { success: false, error: "Forbidden: Owner role required." };
  }

  // Find target staff profile
  const { data: targetProfile, error: profErr } = await supabase
    .from("profiles")
    .select("id, kind, is_blocked, is_deactivated")
    .eq("email", cleanEmail)
    .single();

  if (profErr || !targetProfile) {
    return { success: false, error: "User with this email not found." };
  }

  if (targetProfile.kind !== "staff") {
    return { success: false, error: "Only verified staff members can be designated as moderators." };
  }

  if (targetProfile.is_blocked || targetProfile.is_deactivated) {
    return { success: false, error: "Cannot assign moderator role to a blocked or deactivated account." };
  }

  // Check if already moderator
  const { data: existingRole } = await supabase
    .from("app_roles")
    .select("id")
    .eq("user_id", targetProfile.id)
    .eq("role", "moderator")
    .single();

  if (existingRole) {
    return { success: false, error: "This staff member is already a moderator." };
  }

  // Assign moderator role
  const { error: insertErr } = await supabase.from("app_roles").insert({
    user_id: targetProfile.id,
    role: "moderator",
  });

  if (insertErr) {
    return { success: false, error: insertErr.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "moderator_added",
    target: `profile:${targetProfile.id}`,
    metadata: { assigned_role: "moderator" },
  });

  return { success: true, data: { success: true } };
}

/**
 * 3. Remove Moderator (Spec F14 Requirement 4: Enforces at least 2 moderators required)
 */
export async function removeModeratorAction(
  userId: string,
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Verify Owner Role
  const { data: ownerRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .single();

  if (!ownerRole) {
    return { success: false, error: "Forbidden: Owner role required." };
  }

  // Count current active moderators
  const { count: modCount, error: countErr } = await supabase
    .from("app_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "moderator");

  if (countErr) {
    return { success: false, error: countErr.message };
  }

  if ((modCount || 0) <= 2) {
    return {
      success: false,
      error: "Requirement: System must maintain at least 2 active moderators at all times. Cannot remove moderator.",
    };
  }

  // Delete role
  const { error: delErr } = await supabase
    .from("app_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "moderator");

  if (delErr) {
    return { success: false, error: delErr.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "moderator_removed",
    target: `profile:${userId}`,
    metadata: { removed_role: "moderator" },
  });

  return { success: true, data: { success: true } };
}
