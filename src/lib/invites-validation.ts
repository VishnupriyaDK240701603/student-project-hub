/**
 * Synchronous validation and constants for Team Invites, Selection, and Headcount
 */

export const EXPIRY_PRESETS = [
  { label: "24 Hours (1 Day)", hours: 24 },
  { label: "48 Hours (2 Days)", hours: 48 },
  { label: "72 Hours (3 Days)", hours: 72 },
  { label: "7 Days (1 Week)", hours: 168 },
] as const;

export const MIN_EXPIRY_HOURS = 1;
export const MAX_EXPIRY_HOURS = 336; // 14 days maximum

/**
 * Validate expiry duration in hours
 */
export function validateInviteExpiryHours(hours: number): { valid: boolean; error?: string } {
  if (typeof hours !== "number" || isNaN(hours)) {
    return { valid: false, error: "Expiry hours must be a valid number." };
  }
  if (!Number.isInteger(hours)) {
    return { valid: false, error: "Expiry hours must be an integer." };
  }
  if (hours < MIN_EXPIRY_HOURS) {
    return { valid: false, error: `Expiry cannot be less than ${MIN_EXPIRY_HOURS} hour.` };
  }
  if (hours > MAX_EXPIRY_HOURS) {
    return { valid: false, error: `Expiry cannot exceed ${MAX_EXPIRY_HOURS} hours (14 days).` };
  }
  return { valid: true };
}

/**
 * Calculate ISO string timestamp for invite expiry given hours from now
 */
export function calculateExpiresAt(hours: number, baseDate: Date = new Date()): string {
  const expiresDate = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
  return expiresDate.toISOString();
}

/**
 * Checks whether an invite's expiration date has passed
 */
export function isInviteExpired(expiresAt: string | null | undefined, currentDate: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= currentDate.getTime();
}

/**
 * Calculate remaining open spots for a team request
 * Invariant 4: Count drops ONLY on acceptance, NOT on selection!
 */
export function calculateRemainingSpots(headcount: number, acceptedCount: number): number {
  return Math.max(0, headcount - acceptedCount);
}

/**
 * Validate written reason for member replacement / removal
 * Requirement 5: Removal needs a written reason (minimum length: 10 chars)
 */
export function validateReplacementReason(reason: string): { valid: boolean; error?: string } {
  const trimmed = reason ? reason.trim() : "";
  if (trimmed.length < 10) {
    return { valid: false, error: "A written reason of at least 10 characters is required for member removal." };
  }
  if (trimmed.length > 500) {
    return { valid: false, error: "Reason cannot exceed 500 characters." };
  }
  return { valid: true };
}
