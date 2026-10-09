import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { RoomCard } from "@/components/rooms/RoomCard";
import { Button } from "@/components/ui/Button";
import { getMyRoomsAction } from "@/server/actions/rooms";

export const metadata = {
  title: "My Project Rooms - Student Project Hub",
  description: "Private team collaboration rooms with chat, task boards, and files.",
};

export default async function RoomsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile and active rooms concurrently
  const [profileRes, roomsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, department, kind")
      .eq("id", user.id)
      .maybeSingle(),
    getMyRoomsAction(),
  ]);

  const profile = profileRes.data;
  const rooms = roomsRes.success && roomsRes.data ? roomsRes.data : [];

  return (
    <AppShell
      userName={profile?.display_name || "Student"}
      userDepartment={profile?.department || "General"}
      userKind={profile?.kind || "student"}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              My Project Rooms
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Private workspaces for formed teams. Collaborate with task boards, files, and realtime discussions.
            </p>
          </div>
          <Link href="/requests">
            <Button variant="outline" size="sm">
              Explore Requests
            </Button>
          </Link>
        </div>

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/50 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No Active Project Rooms</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                You are not currently in any project teams. When your applications are accepted or your team request reaches headcount, your private room will appear here.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/requests">
                <Button variant="primary">Browse Open Requests</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} currentUserId={user.id} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
