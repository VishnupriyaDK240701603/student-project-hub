import { sanitizeText } from "@/lib/sanitize";
import { TASK_LIMITS } from "@/lib/tasks-validation";

export const AI_PLAN_LIMITS = {
  maxTasksPerPlan: 30,
  maxSubtasksPerTask: 10,
  maxPlanTitleLength: 120,
} as const;

export interface AiSubtaskItem {
  title: string;
}

export interface AiTaskItem {
  title: string;
  description?: string | null;
  subtasks?: AiSubtaskItem[];
}

export interface AiPlanProposal {
  type: "plan";
  title: string;
  summary?: string;
  tasks: AiTaskItem[];
}

export interface ParsedAiResponse {
  isPlan: boolean;
  plan?: AiPlanProposal;
  cleanText: string;
}

/**
 * Validate and sanitize an AI generated plan proposal.
 */
export function validateAndSanitizePlan(rawPlan: unknown): {
  isValid: boolean;
  error?: string;
  plan?: AiPlanProposal;
} {
  if (!rawPlan || typeof rawPlan !== "object") {
    return { isValid: false, error: "Invalid plan format." };
  }

  const p = rawPlan as Record<string, unknown>;

  if (p.type !== "plan" && !Array.isArray(p.tasks)) {
    return { isValid: false, error: "Missing plan type or tasks array." };
  }

  const rawTitle = typeof p.title === "string" ? p.title : "Proposed Task Plan";
  const sanitizedTitle = sanitizeText(rawTitle).slice(0, AI_PLAN_LIMITS.maxPlanTitleLength);

  const rawSummary = typeof p.summary === "string" ? sanitizeText(p.summary) : undefined;

  if (!Array.isArray(p.tasks) || p.tasks.length === 0) {
    return { isValid: false, error: "Plan must contain at least one task." };
  }

  if (p.tasks.length > AI_PLAN_LIMITS.maxTasksPerPlan) {
    return {
      isValid: false,
      error: `Plan exceeds maximum limit of ${AI_PLAN_LIMITS.maxTasksPerPlan} tasks.`,
    };
  }

  const sanitizedTasks: AiTaskItem[] = [];

  for (const rawTask of p.tasks) {
    if (!rawTask || typeof rawTask !== "object") continue;
    const t = rawTask as Record<string, unknown>;

    const taskTitle = sanitizeText(typeof t.title === "string" ? t.title : "").trim();
    if (!taskTitle) continue;

    const taskDesc =
      typeof t.description === "string"
        ? sanitizeText(t.description).slice(0, TASK_LIMITS.maxDescriptionLength)
        : null;

    const sanitizedSubtasks: AiSubtaskItem[] = [];
    if (Array.isArray(t.subtasks)) {
      for (const rawSub of t.subtasks.slice(0, AI_PLAN_LIMITS.maxSubtasksPerTask)) {
        if (!rawSub) continue;
        const subTitle = typeof rawSub === "string" ? rawSub : typeof rawSub.title === "string" ? rawSub.title : "";
        const cleanSubTitle = sanitizeText(subTitle).slice(0, TASK_LIMITS.maxTitleLength).trim();
        if (cleanSubTitle) {
          sanitizedSubtasks.push({ title: cleanSubTitle });
        }
      }
    }

    sanitizedTasks.push({
      title: taskTitle.slice(0, TASK_LIMITS.maxTitleLength),
      description: taskDesc,
      subtasks: sanitizedSubtasks.length > 0 ? sanitizedSubtasks : undefined,
    });
  }

  if (sanitizedTasks.length === 0) {
    return { isValid: false, error: "No valid tasks found in plan." };
  }

  return {
    isValid: true,
    plan: {
      type: "plan",
      title: sanitizedTitle,
      summary: rawSummary,
      tasks: sanitizedTasks,
    },
  };
}

/**
 * Parse AI response text to extract conversational answer and optional structured plan.
 */
export function parseAiResponse(rawResponseText: string): ParsedAiResponse {
  if (!rawResponseText) {
    return { isPlan: false, cleanText: "" };
  }

  // 1. Check for fenced json block ```json ... ```
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = jsonBlockRegex.exec(rawResponseText);

  if (match) {
    try {
      const parsedJson = JSON.parse(match[1]);
      const validated = validateAndSanitizePlan(parsedJson);
      if (validated.isValid && validated.plan) {
        // Remove the json block from display text if needed or keep introductory text
        const textBeforeJson = rawResponseText.slice(0, match.index).trim();
        return {
          isPlan: true,
          plan: validated.plan,
          cleanText: textBeforeJson || validated.plan.summary || "Here is the proposed project plan:",
        };
      }
    } catch {
      // JSON parse failed, treat as normal text
    }
  }

  // 2. Check if the entire raw text is valid JSON
  try {
    const directJson = JSON.parse(rawResponseText.trim());
    const validated = validateAndSanitizePlan(directJson);
    if (validated.isValid && validated.plan) {
      return {
        isPlan: true,
        plan: validated.plan,
        cleanText: validated.plan.summary || "Here is the proposed project plan:",
      };
    }
  } catch {
    // Not direct JSON
  }

  return {
    isPlan: false,
    cleanText: sanitizeText(rawResponseText),
  };
}
