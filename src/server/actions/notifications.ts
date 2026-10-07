"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dispatchNotificationEmail } from "@/lib/notifications/email-service";
import {
  createSafePushPayload,
  sendWebPushNotification,
} from "@/lib/notifications/push-service";
import type { Notification, Application, TeamRequest } from "@/types/database.types";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApplicationOutcomeItem extends Application {
  team_requests: {
    id: string;
    title: string;
    role_needed: string;
    status: string;
    lead_id: string;
    profiles?: {
      display_name: string;
      department: string;
    };
  } | null;
}

export interface TypedInboxData {
  invites: Array<Application & { team_requests: TeamRequest | null }>;
  outcomes: ApplicationOutcomeItem[];
  notifications: Notification[];
  unreadCount: number;
}

/**
 * 1. Save or update Web Push Subscription
 */
export async function savePushSubscriptionAction(subscription: {
  endpoint: string;
  p256dh: string;
  authKey: string;
}): Promise<ActionResult<{ saved: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth_key: subscription.authKey,
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { saved: true } };
}

/**
 * 2. Unsubscribe from Web Push
 */
export async function deletePushSubscriptionAction(
  endpoint: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { deleted: true } };
}

/**
 * 3. Mark all notifications as read
 */
export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: { count: data?.length || 0 } };
}

/**
 * 4. Fetch typed inbox items (invites, application outcomes, and activity notifications)
 */
export async function getTypedInboxItemsAction(): Promise<ActionResult<TypedInboxData>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // 1. Fetch pending invites
  const { data: invites } = await supabase
    .from("applications")
    .select("*, team_requests(*)")
    .eq("applicant_id", user.id)
    .eq("status", "selected")
    .order("created_at", { ascending: false });

  // 2. Fetch all user applications (for outcomes tab)
  const { data: outcomes } = await supabase
    .from("applications")
    .select("*, team_requests(id, title, role_needed, status, lead_id, profiles:lead_id(display_name, department))")
    .eq("applicant_id", user.id)
    .order("updated_at", { ascending: false });

  // 3. Fetch notifications
  const { data: notifs } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const notificationsList = (notifs || []) as Notification[];
  const unreadNotifs = notificationsList.filter((n) => !n.is_read).length;
  const pendingInvitesCount = (invites || []).length;

  return {
    success: true,
    data: {
      invites: (invites || []) as unknown as Array<Application & { team_requests: TeamRequest | null }>,
      outcomes: (outcomes || []) as unknown as ApplicationOutcomeItem[],
      notifications: notificationsList,
      unreadCount: unreadNotifs + pendingInvitesCount,
    },
  };
}

/**
 * 5. Complete Selection Notification Dispatch
 * Creates inbox record + sends Email (Resend) + sends Web Push (VAPID generic title only)
 */
export async function sendSelectionNotificationPipeline(params: {
  applicationId: string;
  applicantId: string;
  applicantEmail: string;
  applicantName: string;
  projectTitle: string;
  roleNeeded: string;
  expiryHours: number;
}): Promise<ActionResult<{ emailSent: boolean; pushSent: boolean }>> {
  const supabase = await createServerSupabaseClient();

  const eventId = `selection-${params.applicationId}-${Date.now()}`;
  const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/inbox`;

  // 1. Create Inbox notification record
  await supabase.from("notifications").insert({
    user_id: params.applicantId,
    type: "selection_invite",
    title: "Team Invite Received!",
    body: `You have been selected to join "${params.projectTitle}" as ${params.roleNeeded}. Please respond within ${params.expiryHours} hours.`,
    link: "/inbox",
  });

  // 2. Dispatch Email via Resend (Subject to non-prod safety and idempotency)
  const emailResult = await dispatchNotificationEmail({
    eventId,
    eventType: "selection_invite",
    recipientEmail: params.applicantEmail,
    recipientName: params.applicantName,
    projectTitle: params.projectTitle,
    roleOrLead: params.roleNeeded,
    expiryHours: params.expiryHours,
    actionUrl,
  });

  // 3. Dispatch Web Push if user has active subscription
  let pushSent = false;
  const { data: sub } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", params.applicantId)
    .maybeSingle();

  if (sub) {
    // Privacy Invariant: Payload contains NO message text
    const safePayload = createSafePushPayload("Team Invitation Received", "/inbox");
    const pushResult = await sendWebPushNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      safePayload,
    );
    pushSent = pushResult.success;
  }

  return {
    success: true,
    data: {
      emailSent: emailResult.success && !emailResult.skipped,
      pushSent,
    },
  };
}
