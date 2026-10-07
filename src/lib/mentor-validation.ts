/**
 * Pure Validation and Invariant Rules for Mentors and Staff Console
 * Prompt 13 (Spec F12, Invariant 4, APP_LIMITS.maxPendingMentorInvitesPerStaff = 10)
 */

import { APP_LIMITS } from "@/config/limits";

export const MENTOR_EXPIRY_PRESETS = [
  { label: "24 Hours", hours: 24 },
  { label: "48 Hours", hours: 48 },
  { label: "72 Hours", hours: 72 },
  { label: "7 Days", hours: 168 },
] as const;

export const MIN_MENTOR_EXPIRY_HOURS = 1;
export const MAX_MENTOR_EXPIRY_HOURS = 336; // 14 days

export interface MentorInviteValidationInput {
  roomId?: string;
  staffId?: string;
  expiryHours?: number;
  note?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  calculatedExpiresAt?: string;
}

/**
 * 1. Validate Expiry and Input for Mentor Invite
 */
export function validateMentorInviteInput(
  input: MentorInviteValidationInput,
  now: Date = new Date(),
): ValidationResult {
  if (!input.roomId || input.roomId.trim().length === 0) {
    return { valid: false, error: "Project room ID is required." };
  }

  if (!input.staffId || input.staffId.trim().length === 0) {
    return { valid: false, error: "Staff mentor selection is required." };
  }

  const hours = input.expiryHours ?? 48;
  if (!Number.isInteger(hours) || hours < MIN_MENTOR_EXPIRY_HOURS || hours > MAX_MENTOR_EXPIRY_HOURS) {
    return {
      valid: false,
      error: `Expiry duration must be an integer between ${MIN_MENTOR_EXPIRY_HOURS} and ${MAX_MENTOR_EXPIRY_HOURS} hours.`,
    };
  }

  const expiresDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return {
    valid: true,
    calculatedExpiresAt: expiresDate.toISOString(),
  };
}

/**
 * 2. Enforce Pending Mentor Invites Limit (Requirement 3: at most 10 pending invites per staff member)
 * Invariant 10 / Prompt 13 Requirement 3: Server enforced.
 */
export function validateStaffPendingLimit(currentPendingCount: number): ValidationResult {
  const max = APP_LIMITS.maxPendingMentorInvitesPerStaff;
  if (currentPendingCount >= max) {
    return {
      valid: false,
      error: `This staff member already has the maximum of ${max} pending mentor invitations.`,
    };
  }

  return { valid: true };
}

/**
 * 3. Mentor Role Invariants (Requirement 4)
 * An accepted mentor joins as role mentor: reads and writes chat, views every member's progress,
 * does NOT count toward the headcount, and CANNOT become lead.
 */
export function isMentorEligibleForLead(role: string): boolean {
  return role !== "mentor";
}

export function doesRoleCountTowardHeadcount(role: string): boolean {
  return role === "lead" || role === "member";
}

/**
 * 4. Time-travel test helper for mentor invite expiration
 */
export function isMentorInviteExpired(
  expiresAt: string | Date,
  now: Date = new Date(),
): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return expiry.getTime() <= now.getTime();
}
