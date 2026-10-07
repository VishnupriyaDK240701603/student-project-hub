import { sanitizeText } from "@/lib/sanitize";
import type { Task, TaskStatusEnum } from "@/types/database.types";

export const TASK_LIMITS = {
  maxTitleLength: 120,
  minTitleLength: 1,
  maxDescriptionLength: 2000,
  maxCommentLength: 1000,
  maxMeetingTitleLength: 120,
  maxMilestoneTitleLength: 120,
  maxSubtasksPerTask: 20,
  maxAssigneesPerTask: 10,
} as const;

export interface TaskValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedTitle?: string;
  sanitizedDescription?: string | null;
}

export interface TaskCommentValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedContent?: string;
}

export interface MilestoneValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedTitle?: string;
  dueDate?: string;
}

export interface MeetingValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedTitle?: string;
  meetingLink?: string;
  scheduledAt?: string;
}

/**
 * Validate task creation or update payload.
 */
export function validateTaskInput(data: {
  title: string;
  description?: string | null;
  status?: TaskStatusEnum;
  due_date?: string | null;
}): TaskValidationResult {
  const sanitizedTitle = sanitizeText(data.title || "").trim();

  if (!sanitizedTitle) {
    return { isValid: false, error: "Task title is required." };
  }

  if (sanitizedTitle.length > TASK_LIMITS.maxTitleLength) {
    return {
      isValid: false,
      error: `Task title cannot exceed ${TASK_LIMITS.maxTitleLength} characters.`,
    };
  }

  let sanitizedDescription: string | null = null;
  if (data.description !== undefined && data.description !== null) {
    sanitizedDescription = sanitizeText(data.description).trim();
    if (sanitizedDescription.length > TASK_LIMITS.maxDescriptionLength) {
      return {
        isValid: false,
        error: `Task description cannot exceed ${TASK_LIMITS.maxDescriptionLength} characters.`,
      };
    }
    if (sanitizedDescription === "") {
      sanitizedDescription = null;
    }
  }

  if (data.due_date) {
    const d = new Date(data.due_date);
    if (isNaN(d.getTime())) {
      return { isValid: false, error: "Invalid due date format." };
    }
  }

  const validStatuses: TaskStatusEnum[] = ["todo", "in_progress", "done"];
  if (data.status && !validStatuses.includes(data.status)) {
    return { isValid: false, error: "Invalid task status." };
  }

  return {
    isValid: true,
    sanitizedTitle,
    sanitizedDescription,
  };
}

/**
 * Validate single-level subtask constraint.
 * A task can only have a parent_id if the parent task itself has NO parent_id.
 */
export function validateSubtaskHierarchy(parentTask: { parent_id: string | null } | null): {
  isValid: boolean;
  error?: string;
} {
  if (!parentTask) {
    return { isValid: true };
  }

  if (parentTask.parent_id !== null) {
    return {
      isValid: false,
      error: "Subtasks cannot have subtasks (one level of subtasks only).",
    };
  }

  return { isValid: true };
}

/**
 * Validate task comment.
 */
export function validateTaskComment(content: string): TaskCommentValidationResult {
  const sanitized = sanitizeText(content || "").trim();

  if (!sanitized) {
    return { isValid: false, error: "Comment content cannot be empty." };
  }

  if (sanitized.length > TASK_LIMITS.maxCommentLength) {
    return {
      isValid: false,
      error: `Comment cannot exceed ${TASK_LIMITS.maxCommentLength} characters.`,
    };
  }

  return {
    isValid: true,
    sanitizedContent: sanitized,
  };
}

/**
 * Validate milestone input.
 */
export function validateMilestoneInput(data: {
  title: string;
  due_date: string;
}): MilestoneValidationResult {
  const sanitizedTitle = sanitizeText(data.title || "").trim();

  if (!sanitizedTitle) {
    return { isValid: false, error: "Milestone title is required." };
  }

  if (sanitizedTitle.length > TASK_LIMITS.maxMilestoneTitleLength) {
    return {
      isValid: false,
      error: `Milestone title cannot exceed ${TASK_LIMITS.maxMilestoneTitleLength} characters.`,
    };
  }

  const d = new Date(data.due_date);
  if (isNaN(d.getTime())) {
    return { isValid: false, error: "Invalid milestone due date." };
  }

  return {
    isValid: true,
    sanitizedTitle,
    dueDate: d.toISOString(),
  };
}

/**
 * Validate meeting input.
 */
export function validateMeetingInput(data: {
  title: string;
  meeting_link: string;
  scheduled_at: string;
}): MeetingValidationResult {
  const sanitizedTitle = sanitizeText(data.title || "").trim();

  if (!sanitizedTitle) {
    return { isValid: false, error: "Meeting title is required." };
  }

  if (sanitizedTitle.length > TASK_LIMITS.maxMeetingTitleLength) {
    return {
      isValid: false,
      error: `Meeting title cannot exceed ${TASK_LIMITS.maxMeetingTitleLength} characters.`,
    };
  }

  const trimmedLink = (data.meeting_link || "").trim();
  if (!trimmedLink) {
    return { isValid: false, error: "Meeting link is required." };
  }

  // Basic URL validation
  try {
    const parsedUrl = new URL(trimmedLink);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { isValid: false, error: "Meeting link must be a valid HTTP/HTTPS URL." };
    }
  } catch {
    return { isValid: false, error: "Meeting link must be a valid URL." };
  }

  const d = new Date(data.scheduled_at);
  if (isNaN(d.getTime())) {
    return { isValid: false, error: "Invalid meeting scheduled date/time." };
  }

  return {
    isValid: true,
    sanitizedTitle,
    meetingLink: trimmedLink,
    scheduledAt: d.toISOString(),
  };
}

// ---------- Progress Calculation ----------

export interface TaskWithAssigneesAndSubtasks extends Task {
  subtasks?: Task[];
  assignees?: { user_id: string }[];
}

export interface MemberProgressSummary {
  userId: string;
  assignedCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  overdueCount: number;
  progressPercentage: number;
}

export interface TeamProgressSummary {
  totalLeafTasks: number;
  doneLeafTasks: number;
  inProgressLeafTasks: number;
  todoLeafTasks: number;
  overdueLeafTasks: number;
  teamProgressPercentage: number;
  membersProgress: MemberProgressSummary[];
}

/**
 * Calculate team and individual progress.
 * Formula: done leaf items / all leaf items
 * A leaf item is:
 * - A root task that has NO subtasks (0 children).
 * - A subtask (all subtasks are leaves by definition).
 */
export function calculateRoomProgress(
  tasks: TaskWithAssigneesAndSubtasks[],
  allMemberUserIds: string[] = [],
  now: Date = new Date(),
): TeamProgressSummary {
  // Collect all leaf items with their effective assignees
  interface LeafItem {
    id: string;
    status: TaskStatusEnum;
    due_date: string | null;
    assigneeIds: string[];
    isOverdue: boolean;
  }

  const leafItems: LeafItem[] = [];

  // Index subtasks by parent_id
  const rootTasks = tasks.filter((t) => !t.parent_id);
  const subtasksByParent = new Map<string, TaskWithAssigneesAndSubtasks[]>();

  for (const t of tasks) {
    if (t.parent_id) {
      const existing = subtasksByParent.get(t.parent_id) || [];
      existing.push(t);
      subtasksByParent.set(t.parent_id, existing);
    }
  }

  for (const root of rootTasks) {
    const children = (subtasksByParent.get(root.id) || root.subtasks || []) as TaskWithAssigneesAndSubtasks[];
    const rootAssigneeIds = (root.assignees || []).map((a) => a.user_id);

    if (children.length === 0) {
      // Root task has no subtasks -> it is a leaf item
      const isOverdue =
        root.status !== "done" &&
        root.due_date !== null &&
        new Date(root.due_date).getTime() < now.getTime();

      leafItems.push({
        id: root.id,
        status: root.status,
        due_date: root.due_date,
        assigneeIds: rootAssigneeIds,
        isOverdue,
      });
    } else {
      // Root task has subtasks -> the subtasks are the leaf items
      for (const child of children) {
        const childAssigneeIds =
          child.assignees && child.assignees.length > 0
            ? child.assignees.map((a) => a.user_id)
            : rootAssigneeIds; // Inherit parent assignees if child has none specified

        const isOverdue =
          child.status !== "done" &&
          child.due_date !== null &&
          new Date(child.due_date).getTime() < now.getTime();

        leafItems.push({
          id: child.id,
          status: child.status,
          due_date: child.due_date,
          assigneeIds: childAssigneeIds,
          isOverdue,
        });
      }
    }
  }

  const totalLeafTasks = leafItems.length;
  const doneLeafTasks = leafItems.filter((i) => i.status === "done").length;
  const inProgressLeafTasks = leafItems.filter((i) => i.status === "in_progress").length;
  const todoLeafTasks = leafItems.filter((i) => i.status === "todo").length;
  const overdueLeafTasks = leafItems.filter((i) => i.isOverdue).length;

  const teamProgressPercentage =
    totalLeafTasks > 0 ? Math.round((doneLeafTasks / totalLeafTasks) * 100) : 0;

  // Individual member progress
  const membersProgress: MemberProgressSummary[] = allMemberUserIds.map((userId) => {
    const userLeaves = leafItems.filter((item) => item.assigneeIds.includes(userId));
    const assignedCount = userLeaves.length;
    const doneCount = userLeaves.filter((i) => i.status === "done").length;
    const inProgressCount = userLeaves.filter((i) => i.status === "in_progress").length;
    const todoCount = userLeaves.filter((i) => i.status === "todo").length;
    const overdueCount = userLeaves.filter((i) => i.isOverdue).length;
    const progressPercentage =
      assignedCount > 0 ? Math.round((doneCount / assignedCount) * 100) : 0;

    return {
      userId,
      assignedCount,
      doneCount,
      inProgressCount,
      todoCount,
      overdueCount,
      progressPercentage,
    };
  });

  return {
    totalLeafTasks,
    doneLeafTasks,
    inProgressLeafTasks,
    todoLeafTasks,
    overdueLeafTasks,
    teamProgressPercentage,
    membersProgress,
  };
}
