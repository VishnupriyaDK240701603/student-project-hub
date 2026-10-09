"use server";

import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  validateTaskInput,
  validateSubtaskHierarchy,
  validateTaskComment,
  validateMilestoneInput,
  validateMeetingInput,
  calculateRoomProgress,
  type TeamProgressSummary,
  type TaskWithAssigneesAndSubtasks,
} from "@/lib/tasks-validation";
import type { ActionResult } from "./rooms";
import type {
  Task,
  TaskAssignee,
  TaskComment,
  TaskAttachment,
  Milestone,
  Meeting,
  Profile,
  TaskStatusEnum,
} from "@/types/database.types";

// ---------- Types ----------

export interface TaskWithDetails extends Task {
  subtasks: (Task & {
    assignees: (TaskAssignee & { profiles: Pick<Profile, "id" | "display_name" | "department"> | null })[];
  })[];
  assignees: (TaskAssignee & { profiles: Pick<Profile, "id" | "display_name" | "department"> | null })[];
  comments: (TaskComment & { profiles: Pick<Profile, "id" | "display_name" | "department"> | null })[];
  attachments: TaskAttachment[];
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  parent_id?: string | null;
  status?: TaskStatusEnum;
  due_date?: string | null;
  assignee_ids?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatusEnum;
  due_date?: string | null;
  assignee_ids?: string[];
}

export type MilestoneWithStatus = Milestone;

export interface MeetingWithCreator extends Meeting {
  profiles: Pick<Profile, "id" | "display_name"> | null;
}

// ---------- Helper: Membership & Permission Verification ----------

interface MemberContext {
  userId: string;
  role: "lead" | "member" | "mentor";
  permissions: {
    can_edit_task_board: boolean;
    can_set_deadlines: boolean;
  };
}

async function getRoomMemberContext(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  roomId: string,
): Promise<{ error?: string; context?: MemberContext }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { data: member, error: memberErr } = await supabase
    .from("room_members")
    .select("role, status, can_edit_tasks, can_set_deadlines")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (memberErr || !member || member.status !== "active") {
    return { error: "Access denied. You must be an active room member." };
  }

  // Also check if user is lead directly on rooms record
  const { data: room } = await supabase
    .from("rooms")
    .select("lead_id")
    .eq("id", roomId)
    .maybeSingle();

  const isLead = member.role === "lead" || (room && room.lead_id === user.id);

  return {
    context: {
      userId: user.id,
      role: isLead ? "lead" : (member.role as "lead" | "member" | "mentor"),
      permissions: {
        can_edit_task_board: isLead || !!member.can_edit_tasks,
        can_set_deadlines: isLead || !!member.can_set_deadlines,
      },
    },
  };
}

// ---------- Tasks Actions ----------

/**
 * Fetch all tasks for a room with assignees, comments, subtasks, and attachments.
 */
export async function getTasksAction(
  roomId: string,
): Promise<ActionResult<{ tasks: TaskWithDetails[] }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr } = await getRoomMemberContext(supabase, roomId);
  if (permErr) return { success: false, error: permErr };

  // Fetch all tasks for the room
  const { data: rawTasks, error: tasksErr } = await supabase
    .from("tasks")
    .select(
      `
      *,
      assignees:task_assignees (
        id,
        task_id,
        user_id,
        created_at,
        profiles:profiles (
          id,
          display_name,
          department
        )
      ),
      comments:task_comments (
        id,
        task_id,
        author_id,
        content,
        created_at,
        profiles:profiles (
          id,
          display_name,
          department
        )
      ),
      attachments:task_attachments (
        id,
        task_id,
        file_name,
        storage_path,
        created_at
      )
    `,
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (tasksErr) {
    return { success: false, error: "Failed to load tasks." };
  }

  const tasksList = (rawTasks || []) as unknown as (Task & {
    assignees: (TaskAssignee & { profiles: Pick<Profile, "id" | "display_name" | "department"> | null })[];
    comments: (TaskComment & { profiles: Pick<Profile, "id" | "display_name" | "department"> | null })[];
    attachments: TaskAttachment[];
  })[];

  // Organize into parent tasks and subtasks
  const rootTasks = tasksList.filter((t) => !t.parent_id);
  const subtasksMap = new Map<string, typeof tasksList>();

  for (const t of tasksList) {
    if (t.parent_id) {
      const existing = subtasksMap.get(t.parent_id) || [];
      existing.push(t);
      subtasksMap.set(t.parent_id, existing);
    }
  }

  const structuredTasks: TaskWithDetails[] = rootTasks.map((root) => ({
    ...root,
    subtasks: subtasksMap.get(root.id) || [],
  }));

  return { success: true, data: { tasks: structuredTasks } };
}

/**
 * Create a new task or subtask. Requires `edit_task_board` permission.
 */
export async function createTaskAction(
  roomId: string,
  input: CreateTaskInput,
): Promise<ActionResult<{ task: Task }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr, context } = await getRoomMemberContext(supabase, roomId);
  if (permErr || !context) return { success: false, error: permErr };

  if (!context.permissions.can_edit_task_board) {
    return {
      success: false,
      error: "You do not have permission to create tasks on this board.",
    };
  }

  // Validate task inputs
  const val = validateTaskInput(input);
  if (!val.isValid || !val.sanitizedTitle) {
    return { success: false, error: val.error || "Invalid task data." };
  }

  // Check parent task if creating a subtask
  if (input.parent_id) {
    const { data: parentTask, error: parentErr } = await supabase
      .from("tasks")
      .select("id, room_id, parent_id")
      .eq("id", input.parent_id)
      .single();

    if (parentErr || !parentTask || parentTask.room_id !== roomId) {
      return { success: false, error: "Parent task not found in this room." };
    }

    const hierarchyVal = validateSubtaskHierarchy(parentTask);
    if (!hierarchyVal.isValid) {
      return { success: false, error: hierarchyVal.error };
    }
  }

  // Insert the task
  const { data: newTask, error: insertErr } = await supabase
    .from("tasks")
    .insert({
      room_id: roomId,
      parent_id: input.parent_id || null,
      title: val.sanitizedTitle,
      description: val.sanitizedDescription,
      status: input.status || "todo",
      due_date: input.due_date || null,
      created_by: context.userId,
    })
    .select()
    .single();

  if (insertErr || !newTask) {
    return { success: false, error: "Failed to create task." };
  }

  // Add assignees if provided
  if (input.assignee_ids && input.assignee_ids.length > 0) {
    // Verify assignees are active room members
    const { data: validMembers } = await supabase
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("status", "active")
      .in("user_id", input.assignee_ids);

    const validUserIds = (validMembers || []).map((m: { user_id: string }) => m.user_id);
    if (validUserIds.length > 0) {
      const assigneeRows = validUserIds.map((userId: string) => ({
        task_id: newTask.id,
        user_id: userId,
      }));
      const { error: assignErr } = await supabase.from("task_assignees").insert(assigneeRows);
      if (assignErr) {
        const admin = createAdminSupabaseClient();
        if (admin) {
          await admin.from("task_assignees").insert(assigneeRows);
        }
      }
    }
  }

  return { success: true, data: { task: newTask as Task } };
}

/**
 * Update a task details. Requires `edit_task_board` permission.
 */
export async function updateTaskAction(
  taskId: string,
  input: UpdateTaskInput,
): Promise<ActionResult<{ task: Task }>> {
  const supabase = await createServerSupabaseClient();

  // Get task to find room_id
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, room_id, parent_id")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return { success: false, error: "Task not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, task.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  if (!context.permissions.can_edit_task_board) {
    return {
      success: false,
      error: "You do not have permission to edit this task.",
    };
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    const val = validateTaskInput({ title: input.title, description: input.description });
    if (!val.isValid || !val.sanitizedTitle) {
      return { success: false, error: val.error || "Invalid task title." };
    }
    updateData.title = val.sanitizedTitle;
  }

  if (input.description !== undefined) {
    const val = validateTaskInput({
      title: input.title || "temp",
      description: input.description,
    });
    if (!val.isValid) {
      return { success: false, error: val.error };
    }
    updateData.description = val.sanitizedDescription;
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
  }

  if (input.due_date !== undefined) {
    updateData.due_date = input.due_date;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", taskId)
    .select()
    .single();

  if (updateErr || !updated) {
    return { success: false, error: "Failed to update task." };
  }

  // Update assignees if specified
  if (input.assignee_ids !== undefined) {
    const { error: delErr } = await supabase.from("task_assignees").delete().eq("task_id", taskId);
    if (delErr) {
      const admin = createAdminSupabaseClient();
      if (admin) {
        await admin.from("task_assignees").delete().eq("task_id", taskId);
      }
    }

    if (input.assignee_ids.length > 0) {
      const { data: validMembers } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", task.room_id)
        .eq("status", "active")
        .in("user_id", input.assignee_ids);

      const validUserIds = (validMembers || []).map((m: { user_id: string }) => m.user_id);
      if (validUserIds.length > 0) {
        const rows = validUserIds.map((uid: string) => ({
          task_id: taskId,
          user_id: uid,
        }));
        const { error: insErr } = await supabase.from("task_assignees").insert(rows);
        if (insErr) {
          const admin = createAdminSupabaseClient();
          if (admin) {
            await admin.from("task_assignees").insert(rows);
          }
        }
      }
    }
  }

  return { success: true, data: { task: updated as Task } };
}

/**
 * Update task status.
 * Accessible to:
 * 1. Users with `can_edit_task_board` / lead
 * 2. Assignees of this task (Rule D7)
 */
export async function updateTaskStatusAction(
  taskId: string,
  status: TaskStatusEnum,
): Promise<ActionResult<{ task: Task }>> {
  const supabase = await createServerSupabaseClient();

  // Fetch task and its assignees
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, room_id, status, assignees:task_assignees(user_id)")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return { success: false, error: "Task not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, task.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  const isAssignee = (task.assignees || []).some(
    (a: { user_id: string }) => a.user_id === context.userId,
  );

  const canUpdate = context.permissions.can_edit_task_board || isAssignee;

  if (!canUpdate) {
    return {
      success: false,
      error: "You can only update the status of tasks assigned to you.",
    };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select()
    .single();

  if (updateErr || !updated) {
    return { success: false, error: "Failed to update task status." };
  }

  return { success: true, data: { task: updated as Task } };
}

/**
 * Delete a task. Requires `edit_task_board` permission.
 */
export async function deleteTaskAction(taskId: string): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = await createServerSupabaseClient();

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, room_id")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return { success: false, error: "Task not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, task.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  if (!context.permissions.can_edit_task_board) {
    return {
      success: false,
      error: "You do not have permission to delete tasks.",
    };
  }

  const { error: delErr } = await supabase.from("tasks").delete().eq("id", taskId);

  if (delErr) {
    return { success: false, error: "Failed to delete task." };
  }

  return { success: true, data: { deleted: true } };
}

/**
 * Add a comment to a task. Any active room member can comment.
 */
export async function addTaskCommentAction(
  taskId: string,
  content: string,
): Promise<ActionResult<{ comment: TaskComment }>> {
  const supabase = await createServerSupabaseClient();

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, room_id")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return { success: false, error: "Task not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, task.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  const val = validateTaskComment(content);
  if (!val.isValid || !val.sanitizedContent) {
    return { success: false, error: val.error || "Invalid comment." };
  }

  const { data: newComment, error: insertErr } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: context.userId,
      content: val.sanitizedContent,
    })
    .select()
    .single();

  if (insertErr || !newComment) {
    return { success: false, error: "Failed to add comment." };
  }

  return { success: true, data: { comment: newComment as TaskComment } };
}

// ---------- Milestones Actions ----------

export async function getMilestonesAction(
  roomId: string,
): Promise<ActionResult<{ milestones: Milestone[] }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr } = await getRoomMemberContext(supabase, roomId);
  if (permErr) return { success: false, error: permErr };

  const { data: milestones, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("room_id", roomId)
    .order("due_date", { ascending: true });

  if (error) {
    return { success: false, error: error.message || "Failed to load milestones." };
  }

  return { success: true, data: { milestones: (milestones || []) as Milestone[] } };
}

export async function createMilestoneAction(
  roomId: string,
  input: { title: string; due_date: string },
): Promise<ActionResult<{ milestone: Milestone }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr, context } = await getRoomMemberContext(supabase, roomId);
  if (permErr || !context) return { success: false, error: permErr };

  if (!context.permissions.can_set_deadlines) {
    return {
      success: false,
      error: "You do not have permission to set deadlines or create milestones.",
    };
  }

  const val = validateMilestoneInput(input);
  if (!val.isValid || !val.sanitizedTitle || !val.dueDate) {
    return { success: false, error: val.error || "Invalid milestone input." };
  }

  let { data: newMilestone, error } = await supabase
    .from("milestones")
    .insert({
      room_id: roomId,
      title: val.sanitizedTitle,
      due_date: val.dueDate,
      is_completed: false,
    })
    .select()
    .single();

  if (error && (error.message?.includes("row-level security") || error.code === "42501")) {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const adminRes = await admin
        .from("milestones")
        .insert({
          room_id: roomId,
          title: val.sanitizedTitle,
          due_date: val.dueDate,
          is_completed: false,
        })
        .select()
        .single();
      newMilestone = adminRes.data;
      error = adminRes.error;
    }
  }

  if (error || !newMilestone) {
    return { success: false, error: error?.message || "Failed to create milestone." };
  }

  return { success: true, data: { milestone: newMilestone as Milestone } };
}

export async function toggleMilestoneAction(
  milestoneId: string,
  is_completed: boolean,
): Promise<ActionResult<{ milestone: Milestone }>> {
  const supabase = await createServerSupabaseClient();

  const { data: milestone, error: mErr } = await supabase
    .from("milestones")
    .select("id, room_id")
    .eq("id", milestoneId)
    .single();

  if (mErr || !milestone) {
    return { success: false, error: "Milestone not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, milestone.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  if (!context.permissions.can_set_deadlines) {
    return {
      success: false,
      error: "You do not have permission to modify milestones.",
    };
  }

  let { data: updated, error } = await supabase
    .from("milestones")
    .update({ is_completed })
    .eq("id", milestoneId)
    .select()
    .single();

  if (error && (error.message?.includes("row-level security") || error.code === "42501")) {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const adminRes = await admin
        .from("milestones")
        .update({ is_completed })
        .eq("id", milestoneId)
        .select()
        .single();
      updated = adminRes.data;
      error = adminRes.error;
    }
  }

  if (error || !updated) {
    return { success: false, error: error?.message || "Failed to update milestone." };
  }

  return { success: true, data: { milestone: updated as Milestone } };
}

export async function deleteMilestoneAction(milestoneId: string): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = await createServerSupabaseClient();

  const { data: milestone, error: mErr } = await supabase
    .from("milestones")
    .select("id, room_id")
    .eq("id", milestoneId)
    .single();

  if (mErr || !milestone) {
    return { success: false, error: "Milestone not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, milestone.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  if (!context.permissions.can_set_deadlines) {
    return {
      success: false,
      error: "You do not have permission to delete milestones.",
    };
  }

  let { error } = await supabase.from("milestones").delete().eq("id", milestoneId);

  if (error && (error.message?.includes("row-level security") || error.code === "42501")) {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const adminRes = await admin.from("milestones").delete().eq("id", milestoneId);
      error = adminRes.error;
    }
  }

  if (error) {
    return { success: false, error: error.message || "Failed to delete milestone." };
  }

  return { success: true, data: { deleted: true } };
}

// ---------- Meetings Actions ----------

export async function getMeetingsAction(
  roomId: string,
): Promise<ActionResult<{ meetings: MeetingWithCreator[] }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr } = await getRoomMemberContext(supabase, roomId);
  if (permErr) return { success: false, error: permErr };

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select(
      `
      *,
      profiles:created_by (
        id,
        display_name
      )
    `,
    )
    .eq("room_id", roomId)
    .order("scheduled_at", { ascending: true });

  if (error) {
    // Fallback in case of relationship name variation
    const fallback = await supabase
      .from("meetings")
      .select("*")
      .eq("room_id", roomId)
      .order("scheduled_at", { ascending: true });

    if (fallback.error) {
      return { success: false, error: fallback.error.message || "Failed to load meetings." };
    }

    const normalized = (fallback.data || []).map((m: Record<string, unknown>) => ({
      ...m,
      profiles: null,
    }));
    return { success: true, data: { meetings: normalized as unknown as MeetingWithCreator[] } };
  }

  return { success: true, data: { meetings: (meetings || []) as unknown as MeetingWithCreator[] } };
}

export async function createMeetingAction(
  roomId: string,
  input: { title: string; meeting_link: string; scheduled_at: string },
): Promise<ActionResult<{ meeting: Meeting }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr, context } = await getRoomMemberContext(supabase, roomId);
  if (permErr || !context) return { success: false, error: permErr };

  // Any member can add meetings
  const val = validateMeetingInput(input);
  if (!val.isValid || !val.sanitizedTitle || !val.meetingLink || !val.scheduledAt) {
    return { success: false, error: val.error || "Invalid meeting input." };
  }

  let { data: newMeeting, error } = await supabase
    .from("meetings")
    .insert({
      room_id: roomId,
      title: val.sanitizedTitle,
      meeting_link: val.meetingLink,
      scheduled_at: val.scheduledAt,
      created_by: context.userId,
    })
    .select()
    .single();

  if (error && (error.message?.includes("row-level security") || error.code === "42501")) {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const adminRes = await admin
        .from("meetings")
        .insert({
          room_id: roomId,
          title: val.sanitizedTitle,
          meeting_link: val.meetingLink,
          scheduled_at: val.scheduledAt,
          created_by: context.userId,
        })
        .select()
        .single();
      newMeeting = adminRes.data;
      error = adminRes.error;
    }
  }

  if (error || !newMeeting) {
    return { success: false, error: error?.message || "Failed to schedule meeting." };
  }

  return { success: true, data: { meeting: newMeeting as Meeting } };
}

export async function deleteMeetingAction(meetingId: string): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = await createServerSupabaseClient();

  const { data: meeting, error: mErr } = await supabase
    .from("meetings")
    .select("id, room_id, created_by")
    .eq("id", meetingId)
    .single();

  if (mErr || !meeting) {
    return { success: false, error: "Meeting not found." };
  }

  const { error: permErr, context } = await getRoomMemberContext(supabase, meeting.room_id);
  if (permErr || !context) return { success: false, error: permErr };

  const isCreator = meeting.created_by === context.userId;
  const isLead = context.role === "lead";

  if (!isCreator && !isLead) {
    return {
      success: false,
      error: "Only the meeting creator or the room lead can delete a meeting.",
    };
  }

  let { error } = await supabase.from("meetings").delete().eq("id", meetingId);

  if (error && (error.message?.includes("row-level security") || error.code === "42501")) {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const adminRes = await admin.from("meetings").delete().eq("id", meetingId);
      error = adminRes.error;
    }
  }

  if (error) {
    return { success: false, error: error.message || "Failed to delete meeting." };
  }

  return { success: true, data: { deleted: true } };
}

// ---------- Room Progress Dashboard Action ----------

/**
 * Fetch team and individual progress summary.
 * Privacy control:
 * - Lead and Mentor: receive full breakdown of each member's individual progress.
 * - Regular Member: receive team-level progress and ONLY their own individual progress.
 */
export async function getRoomProgressAction(
  roomId: string,
): Promise<ActionResult<{ progress: TeamProgressSummary }>> {
  const supabase = await createServerSupabaseClient();
  const { error: permErr, context } = await getRoomMemberContext(supabase, roomId);
  if (permErr || !context) return { success: false, error: permErr };

  // Fetch active room members
  const { data: members, error: memErr } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("status", "active");

  if (memErr) {
    return { success: false, error: "Failed to load room members." };
  }

  const memberIds = (members || []).map((m: { user_id: string }) => m.user_id);

  // Fetch tasks with assignees
  let rawTasks: Array<{
    id: string;
    room_id: string;
    parent_id: string | null;
    title: string;
    status: string;
    due_date: string | null;
    assignees?: { user_id: string }[];
  }> = [];

  const primaryTasks = await supabase
    .from("tasks")
    .select("id, room_id, parent_id, title, status, due_date, assignees:task_assignees(user_id)")
    .eq("room_id", roomId);

  if (primaryTasks.data && !primaryTasks.error) {
    rawTasks = primaryTasks.data as typeof rawTasks;
  } else {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const adminTasks = await admin
        .from("tasks")
        .select("id, room_id, parent_id, title, status, due_date, assignees:task_assignees(user_id)")
        .eq("room_id", roomId);
      if (adminTasks.data) {
        rawTasks = adminTasks.data as typeof rawTasks;
      }
    }
  }

  // Also query task_assignees directly if joined assignees are empty to ensure no missed relations
  const adminClient = createAdminSupabaseClient() || supabase;
  const { data: allAssigneeRows } = await adminClient
    .from("task_assignees")
    .select("task_id, user_id");

  if (allAssigneeRows && allAssigneeRows.length > 0) {
    const assigneesByTask = new Map<string, { user_id: string }[]>();
    for (const row of allAssigneeRows as { task_id: string; user_id: string }[]) {
      const list = assigneesByTask.get(row.task_id) || [];
      list.push({ user_id: row.user_id });
      assigneesByTask.set(row.task_id, list);
    }

    rawTasks = rawTasks.map((t) => {
      const direct = assigneesByTask.get(t.id);
      if (direct && direct.length > 0) {
        return { ...t, assignees: direct };
      }
      return t;
    });
  }

  const formattedTasks: TaskWithAssigneesAndSubtasks[] = (rawTasks || []).map((t: {
    id: string;
    room_id: string;
    parent_id: string | null;
    title: string;
    status: string;
    due_date: string | null;
    assignees?: { user_id: string }[];
  }) => ({
    id: t.id,
    room_id: t.room_id,
    parent_id: t.parent_id,
    title: t.title,
    description: null,
    status: t.status as TaskStatusEnum,
    due_date: t.due_date,
    created_by: "",
    created_at: "",
    updated_at: "",
    assignees: t.assignees || [],
  }));

  const fullProgress = calculateRoomProgress(formattedTasks, memberIds);

  // Enforce privacy on individual members progress
  const isLeadOrMentor = context.role === "lead" || context.role === "mentor";

  let filteredMembersProgress = fullProgress.membersProgress;
  if (!isLeadOrMentor) {
    // Ordinary member only gets their own progress
    filteredMembersProgress = fullProgress.membersProgress.filter(
      (m) => m.userId === context.userId,
    );
  }

  return {
    success: true,
    data: {
      progress: {
        ...fullProgress,
        membersProgress: filteredMembersProgress,
      },
    },
  };
}
