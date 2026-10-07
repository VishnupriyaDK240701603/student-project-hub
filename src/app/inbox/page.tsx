"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  EmptyState,
  useToast,
} from "@/components/ui";
import { CountdownBadge } from "@/components/invites/CountdownBadge";
import { createClient } from "@/lib/supabase/client";
import {
  acceptInviteAction,
  declineInviteAction,
  markNotificationReadAction,
} from "@/server/actions/invites";
import {
  getTypedInboxItemsAction,
  markAllNotificationsReadAction,
  savePushSubscriptionAction,
  deletePushSubscriptionAction,
  type ApplicationOutcomeItem,
} from "@/server/actions/notifications";
import type { Notification, Application, TeamRequest } from "@/types/database.types";

export default function InboxPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"invites" | "outcomes" | "notifications">("invites");
  const [invites, setInvites] = useState<Array<Application & { team_requests: TeamRequest | null }>>([]);
  const [outcomes, setOutcomes] = useState<ApplicationOutcomeItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  const fetchInboxData = useCallback(async () => {
    setLoading(true);
    const res = await getTypedInboxItemsAction();
    if (res.success && res.data) {
      setInvites(res.data.invites);
      setOutcomes(res.data.outcomes);
      setNotifications(res.data.notifications);
    }
    setLoading(false);
  }, []);

  // 1. Initial Load & Realtime subscription
  useEffect(() => {
    fetchInboxData();

    // Check Push Support
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      if (Notification.permission === "granted") {
        setPushEnabled(true);
      }
    }

    // Realtime Supabase Channel
    const supabase = createClient();
    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchInboxData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInboxData]);

  const handleAcceptInvite = async (applicationId: string) => {
    setActionLoadingId(applicationId);
    const res = await acceptInviteAction(applicationId);
    setActionLoadingId(null);

    if (res.success) {
      showToast({
        type: "success",
        title: "Invitation Accepted! 🎉",
        description: "You have officially joined the project team!",
      });
      fetchInboxData();
    } else {
      showToast({
        type: "error",
        title: "Could Not Join Team",
        description: res.error || "This team has already filled all available spots.",
      });
      fetchInboxData();
    }
  };

  const handleDeclineInvite = async (applicationId: string) => {
    setActionLoadingId(applicationId);
    const res = await declineInviteAction(applicationId);
    setActionLoadingId(null);

    if (res.success) {
      showToast({
        type: "info",
        title: "Invitation Declined",
        description: "You have declined this project team invitation.",
      });
      fetchInboxData();
    } else {
      showToast({
        type: "error",
        title: "Error",
        description: res.error || "Unable to decline invite.",
      });
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    const res = await markNotificationReadAction(notifId);
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n)),
      );
    }
  };

  const handleMarkAllRead = async () => {
    const res = await markAllNotificationsReadAction();
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast({
        type: "success",
        title: "All Marked as Read",
        description: `Marked ${res.data?.count || 0} notifications as read.`,
      });
    }
  };

  const handleTogglePush = async () => {
    if (!pushSupported) {
      showToast({
        type: "error",
        title: "Not Supported",
        description: "Web Push notifications are not supported on this browser.",
      });
      return;
    }

    if (pushEnabled) {
      // Unsubscribe
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await deletePushSubscriptionAction(sub.endpoint);
      }
      setPushEnabled(false);
      showToast({
        type: "info",
        title: "Push Notifications Disabled",
        description: "You will no longer receive device push alerts.",
      });
    } else {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast({
          type: "error",
          title: "Permission Denied",
          description: "Please allow notifications in your browser settings.",
        });
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "dummy_vapid_key",
        });

        const p256dh = sub.getKey("p256dh");
        const auth = sub.getKey("auth");

        await savePushSubscriptionAction({
          endpoint: sub.endpoint,
          p256dh: p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : "",
          authKey: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : "",
        });

        setPushEnabled(true);
        showToast({
          type: "success",
          title: "Push Notifications Enabled!",
          description: "You will now receive alerts for important team events.",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to subscribe to Web Push.";
        showToast({
          type: "error",
          title: "Push Setup Error",
          description: msg,
        });
      }
    }
  };

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;
  const totalUnread = unreadNotifsCount + invites.length;

  return (
    <AppShell unreadInboxCount={totalUnread}>
      <div className="max-w-4xl mx-auto space-y-6 text-left">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Student Inbox
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Respond to selection invites, review application outcomes, and stay updated.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("invites")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "invites"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Invites
              {invites.length > 0 && (
                <Badge variant="accent" size="sm">
                  {invites.length}
                </Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("outcomes")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "outcomes"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Outcomes ({outcomes.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "notifications"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Activity
              {unreadNotifsCount > 0 && (
                <Badge variant="danger" size="sm">
                  {unreadNotifsCount}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {/* Web Push Preferences Banner */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                🔔 Device Web Push Notifications
              </span>
              <Badge variant={pushEnabled ? "accent" : "neutral"} size="sm">
                {pushEnabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Receive instant alerts for invitations and mentions without email clutter.
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              📱 <strong>iPhone users (iOS 16.4+):</strong> Tap Safari Share &gt; <em>&quot;Add to Home Screen&quot;</em> to enable Web Push.
            </p>
          </div>

          <Button
            variant={pushEnabled ? "outline" : "primary"}
            size="sm"
            onClick={handleTogglePush}
            className="text-xs py-1 px-3 self-start sm:self-auto"
          >
            {pushEnabled ? "Disable Push" : "Enable Push"}
          </Button>
        </div>

        {/* Content Tabs */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading inbox...</div>
        ) : activeTab === "invites" ? (
          /* Tab 1: Invites */
          <div className="space-y-4">
            {invites.length === 0 ? (
              <EmptyState
                title="No Pending Team Invites"
                description="When project leads select your application, official invitation offers will appear here."
                action={
                  <Link href="/requests">
                    <Button variant="primary" size="sm">
                      Browse Open Requests
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4">
                {invites.map((invite) => {
                  const req = invite.team_requests;
                  const isLoading = actionLoadingId === invite.id;

                  return (
                    <Card
                      key={invite.id}
                      className="border-indigo-100 dark:border-indigo-950/60 shadow-sm hover:shadow transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="accent">INVITATION OFFER</Badge>
                              <CountdownBadge expiresAt={invite.expires_at} />
                            </div>
                            <CardTitle className="text-base mt-2">
                              <Link
                                href={`/requests/${invite.request_id}`}
                                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              >
                                {req?.title || "Project Team"}
                              </Link>
                            </CardTitle>
                            <CardDescription className="mt-1">
                              Role Offered:{" "}
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {req?.role_needed}
                              </span>
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="py-2">
                        {invite.note && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <p className="font-semibold text-[11px] text-slate-400 mb-1">
                              Your Application Note:
                            </p>
                            &quot;{invite.note}&quot;
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500 mt-2">
                          ⚡ Spots are filled on a first-to-accept basis until team headcount is reached.
                        </p>
                      </CardContent>

                      <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeclineInvite(invite.id)}
                          disabled={isLoading}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAcceptInvite(invite.id)}
                          isLoading={isLoading}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Accept Invitation
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "outcomes" ? (
          /* Tab 2: Application Outcomes */
          <div className="space-y-3">
            {outcomes.length === 0 ? (
              <EmptyState
                title="No Applications Submitted"
                description="You have not applied to any project teams yet."
                action={
                  <Link href="/requests">
                    <Button variant="primary" size="sm">
                      Explore Requests Feed
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3">
                {outcomes.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {item.team_requests?.title || "Project Team"}
                        </h4>
                        <Badge
                          variant={
                            item.status === "accepted"
                              ? "accent"
                              : item.status === "selected"
                                ? "warning"
                                : item.status === "waitlisted"
                                  ? "neutral"
                                  : item.status === "rejected"
                                    ? "danger"
                                    : "neutral"
                          }
                          size="sm"
                        >
                          {item.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Role: {item.team_requests?.role_needed} &bull; Applied:{" "}
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <Link href={`/requests/${item.request_id}`}>
                      <Button variant="outline" size="sm" className="text-xs py-1 px-3">
                        View Details &rarr;
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tab 3: Activity & Notifications */
          <div className="space-y-3">
            {notifications.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  ✓ Mark all as read
                </button>
              </div>
            )}

            {notifications.length === 0 ? (
              <EmptyState
                title="No Notifications Yet"
                description="Updates regarding your team applications, room events, and mentions will appear here."
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 flex items-start justify-between gap-4 transition-colors rounded-lg ${
                      notif.is_read ? "opacity-75" : "bg-indigo-50/40 dark:bg-indigo-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                        🔔
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {notif.title}
                          </h4>
                          {!notif.is_read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {notif.body}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(notif.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {notif.link && (
                        <Link href={notif.link}>
                          <Button variant="outline" size="sm" className="text-xs py-1 px-2.5 h-auto">
                            View
                          </Button>
                        </Link>
                      )}
                      {!notif.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
