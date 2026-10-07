/**
 * Pure Validation and Invariant Rules for Room Management
 * Prompt 12 (Spec F7, Invariants 6 and 8)
 */

export const MIN_REMOVAL_REASON_LENGTH = 10;

export interface MemberPermissions {
  can_edit_tasks: boolean;
  can_set_deadlines: boolean;
  can_invite_mentors: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 1. Validate Member Removal Written Reason
 * Invariant 8: Removal needs a written reason (minimum length 10 characters) shown in the room's event feed.
 */
export function validateRemovalReason(reason?: string | null): ValidationResult & { trimmedReason: string } {
  if (!reason || typeof reason !== "string") {
    return {
      valid: false,
      error: `A written reason of at least ${MIN_REMOVAL_REASON_LENGTH} characters is required for member removal.`,
      trimmedReason: "",
    };
  }

  const trimmed = reason.trim();
  if (trimmed.length < MIN_REMOVAL_REASON_LENGTH) {
    return {
      valid: false,
      error: `Removal reason is too short (${trimmed.length}/${MIN_REMOVAL_REASON_LENGTH} characters required). Please provide a substantive reason.`,
      trimmedReason: trimmed,
    };
  }

  return {
    valid: true,
    trimmedReason: trimmed,
  };
}

/**
 * 2. Sanitize and Validate Member Permissions
 */
export function sanitizeMemberPermissions(permissions: {
  can_edit_tasks?: boolean;
  can_set_deadlines?: boolean;
  can_invite_mentors?: boolean;
}): MemberPermissions {
  return {
    can_edit_tasks: Boolean(permissions.can_edit_tasks),
    can_set_deadlines: Boolean(permissions.can_set_deadlines),
    can_invite_mentors: Boolean(permissions.can_invite_mentors),
  };
}

/**
 * 3. Validate Lead Swap Initiation
 * Flow A: Lead offers to a teammate who must accept.
 * Flow B: Teammate asks and the lead approves or rejects.
 */
export function validateLeadSwapInitiation(
  actorId: string,
  currentLeadId: string,
  targetUserId: string,
): ValidationResult & { flow?: "offer" | "request" } {
  if (!actorId || !currentLeadId || !targetUserId) {
    return { valid: false, error: "Missing required actor, lead, or target user ID." };
  }

  if (actorId === currentLeadId) {
    if (targetUserId === currentLeadId) {
      return { valid: false, error: "Cannot offer leadership to yourself." };
    }
    return { valid: true, flow: "offer" };
  }

  if (actorId === targetUserId) {
    return { valid: true, flow: "request" };
  }

  return {
    valid: false,
    error: "Unauthorized lead transfer initiation: You can only offer leadership to others or request it for yourself.",
  };
}

/**
 * 4. Invariant: Re-adding someone who never accepted is refused, and never a blocked user.
 * Requirement 5: "The lead can re-add only someone who previously accepted, and never a blocked user."
 */
export function validateReAddEligibility(
  hadAcceptedRecord: boolean,
  isBlocked: boolean,
): ValidationResult {
  if (isBlocked) {
    return {
      valid: false,
      error: "Blocked users cannot be re-added to any project room.",
    };
  }

  if (!hadAcceptedRecord) {
    return {
      valid: false,
      error: "Re-adding someone who never accepted an invitation is refused.",
    };
  }

  return { valid: true };
}

/**
 * 5. Permission Check Helpers
 */
export function canUserEditTasks(isLead: boolean, permission: boolean): boolean {
  return isLead || permission;
}

export function canUserSetDeadlines(isLead: boolean, permission: boolean): boolean {
  return isLead || permission;
}

export function canUserInviteMentors(isLead: boolean, permission: boolean): boolean {
  return isLead || permission;
}
