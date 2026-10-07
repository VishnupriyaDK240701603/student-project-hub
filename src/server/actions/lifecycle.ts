"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { CURRENT_CONSENT_VERSION } from "@/config/consent";
import type { ActionResult } from "./rooms";

/**
 * 1. Moderator Deactivates or Reactivates Staff Account (Spec F15 Requirement 2)
 */
export async function toggleStaffDeactivationAction(params: {
  staffId: string;
  deactivate: boolean;
  reason?: string;
}): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Moderator check
  const { data: modRole } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "moderator")
    .single();

  if (!modRole) {
    return { success: false, error: "Forbidden: Moderator role required." };
  }

  // Fetch staff profile
  const { data: staffProfile, error: profErr } = await supabase
    .from("profiles")
    .select("id, kind, is_deactivated")
    .eq("id", params.staffId)
    .single();

  if (profErr || !staffProfile) {
    return { success: false, error: "Staff member profile not found." };
  }

  if (staffProfile.kind !== "staff") {
    return { success: false, error: "Only staff accounts can be managed with this action." };
  }

  // Update profile deactivation status
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      is_deactivated: params.deactivate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.staffId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit log (IDs only, no sensitive content)
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: params.deactivate ? "staff_deactivated" : "staff_reactivated",
    target: `profile:${params.staffId}`,
    metadata: {
      action_by_moderator: user.id,
      reason: params.reason ? sanitizeText(params.reason) : undefined,
    },
  });

  return { success: true, data: { success: true } };
}

/**
 * 2. Record User Consent (Spec F15 Requirement 5: Consent is versioned)
 */
export async function recordUserConsentAction(
  consentVersion: string = CURRENT_CONSENT_VERSION,
): Promise<ActionResult<{ success: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const cleanVersion = sanitizeText(consentVersion.trim());

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      consent_version: cleanVersion,
      consent_given_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "consent_recorded",
    target: `profile:${user.id}`,
    metadata: { consent_version: cleanVersion },
  });

  return { success: true, data: { success: true } };
}
