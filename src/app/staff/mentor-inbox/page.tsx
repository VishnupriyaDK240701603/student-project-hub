import React from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { StaffMentorConsoleClient } from "@/components/mentors/StaffMentorConsoleClient";
import {
  getStaffMentorInvitesAction,
  getStaffPendingInvitesCountAction,
} from "@/server/actions/mentors";

export const metadata = {
  title: "Faculty Mentor Console - Student Project Hub",
  description: "Review and respond to project mentorship invitations.",
};

export default async function StaffMentorInboxPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/staff/mentor-inbox");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, department, kind")
    .eq("id", user.id)
    .single();

  if (!profile || profile.kind !== "staff") {
    redirect("/requests");
  }

  const [invitesRes, pendingCountRes] = await Promise.all([
    getStaffMentorInvitesAction("all"),
    getStaffPendingInvitesCountAction(),
  ]);

  const invites = invitesRes.success && invitesRes.data ? invitesRes.data : [];
  const pendingCount = pendingCountRes.success && pendingCountRes.data ? pendingCountRes.data : 0;

  return (
    <AppShell
      userName={profile.display_name}
      userDepartment={profile.department}
      userKind="staff"
      pendingMentorCount={pendingCount}
    >
      <div className="max-w-6xl mx-auto">
        <StaffMentorConsoleClient initialInvites={invites} />
      </div>
    </AppShell>
  );
}
