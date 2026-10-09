"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createDefaultProvider, type AiProvider } from "@/lib/ai/provider";
import { buildAiPromptMessages, type RoomContextData } from "@/lib/ai/context-builder";
import {
  parseAiResponse,
  validateAndSanitizePlan,
  type AiPlanProposal,
  type ParsedAiResponse,
} from "@/lib/ai/plan-schema";
import { APP_LIMITS } from "@/config/limits";
import type { ActionResult } from "./rooms";
import type { Message, Task, Milestone, Meeting, RoomFile, Profile } from "@/types/database.types";

export interface AskAiResult extends ParsedAiResponse {
  remainingQueries: number;
}

/**
 * Ask the room AI assistant a question or request a task plan.
 */
export async function askRoomAiAction(
  roomId: string,
  query: string,
  customProvider?: AiProvider,
): Promise<ActionResult<AskAiResult>> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // 1. Verify caller is active room member
  const { data: member, error: memberErr } = await supabase
    .from("room_members")
    .select("role, status")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (memberErr || !member || member.status !== "active") {
    return { success: false, error: "Access denied. You must be an active room member." };
  }

  // 2. Check if AI is enabled in environment (enabled by default unless explicitly disabled as "false")
  const isAiDisabled = process.env.AI_ENABLED === "false";
  if (isAiDisabled && !customProvider) {
    return {
      success: true,
      data: {
        isPlan: false,
        cleanText: "The @ai assistant is currently disabled by the college administrator.",
        remainingQueries: 0,
      },
    };
  }

  // 3. Check daily AI usage counter
  const todayDate = new Date().toISOString().slice(0, 10);
  const { data: usageRow } = await supabase
    .from("ai_usage")
    .select("query_count")
    .eq("user_id", user.id)
    .eq("usage_date", todayDate)
    .maybeSingle();

  const currentCount = usageRow?.query_count || 0;
  if (currentCount >= APP_LIMITS.maxAiQueriesPerUserPerDay) {
    return {
      success: false,
      error: `Daily AI limit reached (${APP_LIMITS.maxAiQueriesPerUserPerDay} queries per day). Please try again tomorrow.`,
    };
  }

  // 4. Fetch bounded room context
  const [roomRes, msgRes, taskRes, milestoneRes, meetingRes, fileRes] = await Promise.all([
    supabase.from("rooms").select("team_requests(title, description)").eq("id", roomId).single(),
    supabase
      .from("messages")
      .select("content, created_at, profiles:profiles(display_name, department)")
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("title, status, due_date")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("milestones")
      .select("title, due_date, is_completed")
      .eq("room_id", roomId)
      .order("due_date", { ascending: true })
      .limit(15),
    supabase
      .from("meetings")
      .select("title, scheduled_at")
      .eq("room_id", roomId)
      .order("scheduled_at", { ascending: true })
      .limit(10),
    supabase
      .from("room_files")
      .select("*")
      .eq("room_id", roomId)
      .limit(20),
  ]);

  const teamReq = roomRes.data?.team_requests as { title?: string; description?: string } | null;

  const normalizedFiles = (fileRes.data || []).map((f: Record<string, unknown>) => ({
    file_name: (f.file_name as string) || "file",
    file_type: ((f.file_type || f.mime_type) as string) || "application/octet-stream",
  })) as Pick<RoomFile, "file_name" | "file_type">[];

  const contextData: RoomContextData = {
    projectTitle: teamReq?.title || "Team Project",
    projectDescription: teamReq?.description || null,
    messages: (msgRes.data || []) as unknown as (Pick<Message, "content" | "created_at"> & {
      profiles: Pick<Profile, "display_name" | "department"> | null;
    })[],
    tasks: (taskRes.data || []) as Pick<Task, "title" | "status" | "due_date">[],
    milestones: (milestoneRes.data || []) as Pick<Milestone, "title" | "due_date" | "is_completed">[],
    meetings: (meetingRes.data || []) as Pick<Meeting, "title" | "scheduled_at">[],
    files: normalizedFiles,
  };

  // 5. Build prompt messages and execute AI generation
  const messages = buildAiPromptMessages(query, contextData);
  const provider = customProvider || createDefaultProvider();

  const aiResult = await provider.generate(messages, {
    temperature: 0.7,
    maxTokens: 1024,
  });

  if (aiResult.error) {
    return { success: false, error: aiResult.error };
  }

  // 6. Increment AI usage count
  const newCount = currentCount + 1;
  await supabase.from("ai_usage").upsert(
    {
      user_id: user.id,
      usage_date: todayDate,
      query_count: newCount,
    },
    { onConflict: "user_id, usage_date" },
  );

  // 7. Parse AI response (handles structured JSON plans or text)
  const parsed = parseAiResponse(aiResult.text);

  const remaining = Math.max(0, APP_LIMITS.maxAiQueriesPerUserPerDay - newCount);

  return {
    success: true,
    data: {
      ...parsed,
      remainingQueries: remaining,
    },
  };
}

/**
 * Confirm and materialize an AI-generated task plan into the room task board.
 * Requires `can_edit_tasks` permission.
 */
export async function confirmAiPlanAction(
  roomId: string,
  plan: AiPlanProposal,
): Promise<ActionResult<{ createdTaskCount: number }>> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Authentication required." };
  }

  // Check task board permission
  const { data: member, error: memberErr } = await supabase
    .from("room_members")
    .select("role, status, can_edit_tasks")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .single();

  if (memberErr || !member || member.status !== "active") {
    return { success: false, error: "Access denied. You must be an active room member." };
  }

  const isLead = member.role === "lead";
  const canEditTasks = isLead || !!member.can_edit_tasks;

  if (!canEditTasks) {
    return {
      success: false,
      error: "You do not have permission to create or confirm task plans for this board.",
    };
  }

  // Validate plan schema
  const val = validateAndSanitizePlan(plan);
  if (!val.isValid || !val.plan) {
    return { success: false, error: val.error || "Invalid plan proposal." };
  }

  let createdCount = 0;

  for (const taskItem of val.plan.tasks) {
    // Insert root task
    const { data: rootTask, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        room_id: roomId,
        title: taskItem.title,
        description: taskItem.description || null,
        status: "todo",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (taskErr || !rootTask) continue;
    createdCount++;

    // Insert subtasks (single level)
    if (taskItem.subtasks && taskItem.subtasks.length > 0) {
      const subtaskRows = taskItem.subtasks.map((sub) => ({
        room_id: roomId,
        parent_id: rootTask.id,
        title: sub.title,
        status: "todo",
        created_by: user.id,
      }));

      const { data: insertedSubs } = await supabase
        .from("tasks")
        .insert(subtaskRows)
        .select("id");

      if (insertedSubs) {
        createdCount += insertedSubs.length;
      }
    }
  }

  return { success: true, data: { createdTaskCount: createdCount } };
}
