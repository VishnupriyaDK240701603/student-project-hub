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
import type { TeamRequest, GenderEnum } from "@/types/database.types";

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
  let { data: profile } = await supabase
    .from("profiles")
    .select("kind, department, is_blocked, is_deactivated")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Auto-provision profile as student for logged-in user
    const email = user.email || "";
    const emailPrefix = email.split("@")[0] || "User";
    const displayName = user.user_metadata?.full_name || emailPrefix;

    const { data: newProf } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email,
        display_name: displayName,
        kind: "student",
        admission_year: 2023,
        department: "CSE",
        gender: "prefer_not_to_say",
        consent_version: "v1.0",
      })
      .select("kind, department, is_blocked, is_deactivated")
      .maybeSingle();

    if (newProf) {
      profile = newProf;
    }
  }

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
      department: profile.department || "CSE",
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

  const page = filters.page || 1;
  const limit = filters.limit || 12;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("team_requests")
    .select("*, profiles:lead_id(display_name, department, admission_year)", {
      count: "exact",
    })
    .eq("status", "open")
    .neq("lead_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${sanitizeText(filters.search.trim())}%`;
    query = query.ilike("title", term);
  }

  // Fetch user profile (kind, department, admission_year, gender) and main feed query in parallel
  const [profileRes, feedRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("kind, department, admission_year, gender")
      .eq("id", user.id)
      .maybeSingle(),
    query,
  ]);

  const userProfile = profileRes.data;

  // Invariant: Staff accounts CANNOT browse the requests feed
  if (userProfile?.kind === "staff") {
    return {
      success: true,
      data: { requests: [], total: 0 },
    };
  }

  if (feedRes.error) {
    return { success: false, error: feedRes.error.message };
  }

  const rawRequests = (feedRes.data || []) as unknown as TeamRequest[];
  const userDept = userProfile?.department ? userProfile.department.toLowerCase() : null;
  const userYear = userProfile?.admission_year ?? null;
  const userGender = userProfile?.gender ?? null;

  // Filter requests so students ONLY see requests for which their department/year/gender is eligible
  const eligibleRequests = rawRequests.filter((req) => {
    // 1. Department eligibility: if request specifies filter_departments, student's department MUST be listed
    if (userDept && req.filter_departments && req.filter_departments.length > 0) {
      const allowedDepts = req.filter_departments.map((d) => d.toLowerCase());
      if (!allowedDepts.includes(userDept)) {
        return false;
      }
    }

    // 2. Year eligibility: if request specifies filter_years, student's admission year MUST be listed
    if (userYear !== null && req.filter_years && req.filter_years.length > 0) {
      if (!req.filter_years.includes(userYear)) {
        return false;
      }
    }

    // 3. Gender eligibility: if request specifies filter_genders, student's gender MUST match
    if (userGender && req.filter_genders && req.filter_genders.length > 0) {
      if (userGender === "other" || userGender === "prefer_not_to_say") {
        return false;
      }
      if (!req.filter_genders.includes(userGender as GenderEnum)) {
        return false;
      }
    }

    // 4. UI Dropdown Department Filter (if explicit department filter is selected)
    if (filters.department && filters.department !== "all") {
      const selectedDept = filters.department.toLowerCase();
      const leadProfileDept = ((req as unknown as { profiles?: { department?: string } }).profiles?.department || "").toLowerCase();
      const reqFilterDepts = (req.filter_departments || []).map((d) => d.toLowerCase());
      const matches = leadProfileDept === selectedDept || reqFilterDepts.includes(selectedDept);
      if (!matches) {
        return false;
      }
    }

    return true;
  });

  return {
    success: true,
    data: {
      requests: eligibleRequests,
      total: eligibleRequests.length,
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

  const [requestsRes, roomsRes] = await Promise.all([
    supabase
      .from("team_requests")
      .select("*")
      .eq("lead_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rooms")
      .select("id, initial_request_id")
      .eq("lead_id", user.id),
  ]);

  if (requestsRes.error) {
    return { success: false, error: requestsRes.error.message };
  }

  const originalRequestByRoom = new Map(
    (roomsRes.data || []).map((room) => [room.id, room.initial_request_id] as const),
  );
  const requests = (requestsRes.data || []).filter((request) =>
    !request.room_id || originalRequestByRoom.get(request.room_id) === request.id,
  );

  return { success: true, data: requests as TeamRequest[] };
}

import { closeRequestAction, finalizeTeamAction } from "./rooms";

/**
 * Manually close and finalize a team request to create project room
 */
export async function finalizeTeamRequest(
  requestId: string,
): Promise<ActionResult<{ closed: boolean; roomId?: string }>> {
  return finalizeTeamAction(requestId);
}

export async function closeTeamRequest(
  requestId: string,
): Promise<ActionResult<{ closed: boolean }>> {
  const res = await closeRequestAction(requestId);
  if (!res.success) {
    return { success: false, error: res.error };
  }
  return { success: true, data: { closed: true } };
}
