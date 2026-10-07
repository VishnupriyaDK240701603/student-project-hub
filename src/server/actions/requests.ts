"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { APP_LIMITS } from "@/config/limits";
import { sanitizeText } from "@/lib/sanitize";
import {
  validateRequestData,
  type CreateRequestInput,
  type RequestFeedFilter,
  type ActionResult,
} from "@/lib/requests-validation";
import type { TeamRequest } from "@/types/database.types";

export type { CreateRequestInput, RequestFeedFilter, ActionResult };

/**
 * Create a new team request
 * Server-enforced invariant: maximum 3 open requests per lead
 */
export async function createTeamRequest(
  input: CreateRequestInput,
): Promise<ActionResult<TeamRequest>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Check user kind: staff cannot create student project requests
  const { data: profile } = await supabase
    .from("profiles")
    .select("kind, is_blocked, is_deactivated")
    .eq("id", user.id)
    .single();

  if (!profile || profile.kind !== "student") {
    return { success: false, error: "Only students can create team requests." };
  }

  if (profile.is_blocked || profile.is_deactivated) {
    return { success: false, error: "Your account is restricted from creating requests." };
  }

  // Validate inputs
  const validation = validateRequestData(input);
  if (!validation.valid || !validation.sanitized) {
    return { success: false, error: validation.error };
  }

  // Enforce Max 3 Open Requests limit on server
  const { count: openCount, error: countError } = await supabase
    .from("team_requests")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", user.id)
    .eq("status", "open");

  if (countError) {
    return { success: false, error: "Failed to verify open requests limit." };
  }

  if ((openCount || 0) >= APP_LIMITS.maxOpenRequestsPerLead) {
    return {
      success: false,
      error: `You already have ${APP_LIMITS.maxOpenRequestsPerLead} open requests. Close an existing request before creating a new one.`,
    };
  }

  // Insert into team_requests
  const { data: request, error: insertError } = await supabase
    .from("team_requests")
    .insert({
      lead_id: user.id,
      title: validation.sanitized.title,
      description: validation.sanitized.description,
      role_needed: validation.sanitized.role_needed,
      headcount: validation.sanitized.headcount,
      tags: validation.sanitized.tags,
      filter_years: validation.sanitized.filter_years,
      filter_departments: validation.sanitized.filter_departments,
      filter_genders: validation.sanitized.filter_genders,
      resume_required: validation.sanitized.resume_required,
      status: "open",
    })
    .select()
    .single();

  if (insertError || !request) {
    return { success: false, error: insertError?.message || "Failed to create request." };
  }

  return { success: true, data: request as TeamRequest };
}

/**
 * Fetch team requests feed for current user
 * Staff receives empty/forbidden result.
 * Students only receive requests they are eligible to view based on RLS.
 */
export async function getTeamRequestsFeed(
  filters: RequestFeedFilter = {},
): Promise<ActionResult<{ requests: TeamRequest[]; total: number }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Check user kind
  const { data: profile } = await supabase
    .from("profiles")
    .select("kind")
    .eq("id", user.id)
    .single();

  // Invariant: Staff accounts CANNOT browse the requests feed
  if (profile?.kind === "staff") {
    return {
      success: true,
      data: { requests: [], total: 0 },
    };
  }

  const page = filters.page || 1;
  const limit = filters.limit || 12;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("team_requests")
    .select("*, profiles:lead_id(display_name, department, admission_year)", {
      count: "exact",
    })
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${sanitizeText(filters.search.trim())}%`;
    query = query.ilike("title", term);
  }

  const { data, count, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    data: {
      requests: (data || []) as unknown as TeamRequest[],
      total: count || 0,
    },
  };
}

/**
 * Fetch requests created by the current lead
 */
export async function getMyTeamRequests(): Promise<ActionResult<TeamRequest[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("team_requests")
    .select("*")
    .eq("lead_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as TeamRequest[] };
}

/**
 * Manually close a request
 */
export async function closeTeamRequest(
  requestId: string,
): Promise<ActionResult<{ closed: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("team_requests")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("lead_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { closed: true } };
}
