/**
 * Synchronous utilities and validation for 30-day file retention and follow-up requests
 * Prompt 10
 */

export const RETENTION_DAYS = 30;

/**
 * Calculate file deletion timestamp: closedAt + 30 days
 * Invariant 9: Resumes of unselected applicants are deleted 30 days after close.
 */
export function calculateRetentionExpiry(closedAt: Date = new Date()): string {
  const expiry = new Date(closedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return expiry.toISOString();
}

/**
 * Checks whether an application file is due for hard deletion
 */
export function isFileRetentionExpired(
  deleteAfter: string | null | undefined,
  currentDate: Date = new Date(),
): boolean {
  if (!deleteAfter) return false;
  return new Date(deleteAfter).getTime() <= currentDate.getTime();
}

export interface FollowUpRequestInput {
  roomId: string;
  roleNeeded: string;
  extraHeadcount: number;
  description: string;
  tags?: string[];
  filterYears?: number[];
  filterDepartments?: string[];
  filterGenders?: string[];
  resumeRequired?: boolean;
}

export function validateFollowUpRequestInput(input: FollowUpRequestInput): {
  valid: boolean;
  error?: string;
} {
  if (!input.roomId || !input.roomId.trim()) {
    return { valid: false, error: "A valid existing room ID is required for follow-up requests." };
  }
  if (!input.roleNeeded || input.roleNeeded.trim().length < 3) {
    return { valid: false, error: "Role needed must be at least 3 characters." };
  }
  if (typeof input.extraHeadcount !== "number" || input.extraHeadcount < 1) {
    return { valid: false, error: "Extra people needed must be at least 1." };
  }
  if (!input.description || input.description.trim().length < 15) {
    return { valid: false, error: "Project description must be at least 15 characters." };
  }
  return { valid: true };
}
