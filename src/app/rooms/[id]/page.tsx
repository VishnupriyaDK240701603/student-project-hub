import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { getRoomDetailsAction } from "@/server/actions/rooms";
import {
  getPendingLeadSwapAction,
  getRoomEventsAction,
} from "@/server/actions/room-management";
import { RoomDetailClient } from "./RoomDetailClient";
import type { RoomTab } from "@/components/rooms/RoomShell";

interface RoomPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/rooms/${id}`);
  }

  const [profileRes, roomRes, eventsRes, transferRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, department, kind")
      .eq("id", user.id)
      .maybeSingle(),
    getRoomDetailsAction(id),
    getRoomEventsAction(id),
    getPendingLeadSwapAction(id),
  ]);

  const profile = profileRes.data;

  // Check if room was fetched and user is an active member or mentor
  if (!roomRes.success || !roomRes.data) {
    return (
      <AppShell
        userName={profile?.display_name || "Student"}
        userDepartment={profile?.department || "General"}
        userKind={profile?.kind || "student"}
      >
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Room Access Restricted</h1>
          <p className="text-sm text-muted-foreground">
            This private project room is accessible only to active team members and mentors. If you were removed or left the team, your access has ended.
          </p>
          <div className="pt-2">
            <Link href="/rooms">
              <Button variant="primary">Back to My Rooms</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const room = roomRes.data;
  const isMember = (room.room_members || []).some(
    (m) => m.user_id === user.id && m.status === "active",
  );

  if (!isMember) {
    return (
      <AppShell
        userName={profile?.display_name || "Student"}
        userDepartment={profile?.department || "General"}
        userKind={profile?.kind || "student"}
      >
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You are not an active member of this project room. Membership and realtime access are revoked when removed or after leaving.
          </p>
          <div className="pt-2">
            <Link href="/rooms">
              <Button variant="primary">Back to My Rooms</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const validTabs: RoomTab[] = ["members", "chat", "tasks", "files", "deadlines", "meetings", "dashboard"];
  const initialTab: RoomTab = tab && validTabs.includes(tab as RoomTab) ? (tab as RoomTab) : "members";

  return (
    <AppShell
      userName={profile?.display_name || "Student"}
      userDepartment={profile?.department || "General"}
      userKind={profile?.kind || "student"}
    >
      <div className="max-w-6xl mx-auto">
        <RoomDetailClient
          initialRoom={room}
          initialEvents={eventsRes.success && eventsRes.data ? eventsRes.data : []}
          initialTransfer={transferRes.success ? transferRes.data || null : null}
          currentUserId={user.id}
          initialTab={initialTab}
        />
      </div>
    </AppShell>
  );
}
