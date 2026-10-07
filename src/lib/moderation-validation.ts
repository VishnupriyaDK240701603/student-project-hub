import { sanitizeText } from "@/lib/sanitize";

export const MODERATION_LIMITS = {
  maxReasonLength: 1000,
  minReasonLength: 10,
  maxJustificationLength: 2000,
  minJustificationLength: 10,
  maxAppealReasonLength: 1000,
  minAppealReasonLength: 10,
  maxReportsPerUserPerDay: 5,
  minJustificationHours: 24,
  maxJustificationHours: 168, // 7 days
} as const;

export interface ReportValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedReason?: string;
}

export interface JustificationValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedContent?: string;
}

export interface AppealValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedReason?: string;
}

export function validateReportInput(data: {
  target_type: string;
  target_id: string;
  reason: string;
}): ReportValidationResult {
  const validTypes = ["user", "request", "message"];
  if (!validTypes.includes(data.target_type)) {
    return { isValid: false, error: "Invalid report target type." };
  }

  if (!data.target_id || !data.target_id.trim()) {
    return { isValid: false, error: "Report target ID is required." };
  }

  const sanitized = sanitizeText(data.reason || "").trim();
  if (!sanitized || sanitized.length < MODERATION_LIMITS.minReasonLength) {
    return {
      isValid: false,
      error: `Please provide a reason with at least ${MODERATION_LIMITS.minReasonLength} characters.`,
    };
  }

  if (sanitized.length > MODERATION_LIMITS.maxReasonLength) {
    return {
      isValid: false,
      error: `Report reason cannot exceed ${MODERATION_LIMITS.maxReasonLength} characters.`,
    };
  }

  return {
    isValid: true,
    sanitizedReason: sanitized,
  };
}

export function validateJustificationInput(content: string): JustificationValidationResult {
  const sanitized = sanitizeText(content || "").trim();

  if (!sanitized || sanitized.length < MODERATION_LIMITS.minJustificationLength) {
    return {
      isValid: false,
      error: `Please provide a justification with at least ${MODERATION_LIMITS.minJustificationLength} characters.`,
    };
  }

  if (sanitized.length > MODERATION_LIMITS.maxJustificationLength) {
    return {
      isValid: false,
      error: `Justification cannot exceed ${MODERATION_LIMITS.maxJustificationLength} characters.`,
    };
  }

  return {
    isValid: true,
    sanitizedContent: sanitized,
  };
}

export function validateAppealInput(reason: string): AppealValidationResult {
  const sanitized = sanitizeText(reason || "").trim();

  if (!sanitized || sanitized.length < MODERATION_LIMITS.minAppealReasonLength) {
    return {
      isValid: false,
      error: `Please provide an appeal reason with at least ${MODERATION_LIMITS.minAppealReasonLength} characters.`,
    };
  }

  if (sanitized.length > MODERATION_LIMITS.maxAppealReasonLength) {
    return {
      isValid: false,
      error: `Appeal reason cannot exceed ${MODERATION_LIMITS.maxAppealReasonLength} characters.`,
    };
  }

  return {
    isValid: true,
    sanitizedReason: sanitized,
  };
}

export function validateJustificationDeadlineHours(hours: number): {
  isValid: boolean;
  error?: string;
} {
  if (!Number.isInteger(hours) || hours < MODERATION_LIMITS.minJustificationHours) {
    return {
      isValid: false,
      error: `Justification deadline must be at least ${MODERATION_LIMITS.minJustificationHours} hours (1 day).`,
    };
  }

  if (hours > MODERATION_LIMITS.maxJustificationHours) {
    return {
      isValid: false,
      error: `Justification deadline cannot exceed ${MODERATION_LIMITS.maxJustificationHours} hours (7 days).`,
    };
  }

  return { isValid: true };
}
