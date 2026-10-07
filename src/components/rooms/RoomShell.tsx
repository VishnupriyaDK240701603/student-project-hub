"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { MembersTab } from "./MembersTab";
import { LeaveRoomModal } from "./LeaveRoomModal";
import { ChatTab } from "@/components/chat/ChatTab";
import { FilesTab } from "@/components/chat/FilesTab";
import { TaskBoardTab, ProgressDashboardTab, MilestonesSection, MeetingsSection } from "@/components/tasks";
import { leaveRoomAction, type RoomEventWithActor } from "@/server/actions/room-management";
import { getMilestonesAction, getMeetingsAction, type MeetingWithCreator } from "@/server/actions/tasks";
import type { Room, TeamRequest, RoomMember, Profile, LeadTransfer, Milestone } from "@/types/database.types";

export type RoomTab = "members" | "chat" | "tasks" | "files" | "deadlines" | "meetings" | "dashboard";

export interface RoomShellProps {
  room: Room & {
    team_requests: TeamRequest | null;
    room_members: (RoomMember & { profiles: Profile | null })[];
  };
  currentUserId: string;
  initialTab?: RoomTab;
  pendingTransfer: LeadTransfer | null;
  events: RoomEventWithActor[];
  onRefresh: () => Promise<void>;
}

export const RoomShell: React.FC<RoomShellProps> = ({
  room,
  currentUserId,
  initialTab = "members",
  pendingTransfer,
  events,
  onRefresh,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<RoomTab>(initialTab);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetings, setMeetings] = useState<MeetingWithCreator[]>([]);

  const title = room.team_requests?.title || "Project Room";
  const isLead = room.lead_id === currentUserId;
  const activeMembers = (room.room_members || []).filter((m) => m.status === "active");
  const otherActiveMembersCount = activeMembers.filter((m) => m.user_id !== currentUserId).length;

  const currentMember = (room.room_members || []).find((m) => m.user_id === currentUserId);
  const isMentor = currentMember?.role === "mentor";
  const canEditTaskBoard = isLead || !!currentMember?.can_edit_tasks;
  const canSetDeadlines = isLead || !!currentMember?.can_set_deadlines;

  const loadMilestonesAndMeetings = React.useCallback(async () => {
    const [mRes, meetRes] = await Promise.all([
      getMilestonesAction(room.id),
      getMeetingsAction(room.id),
    ]);
    if (mRes.success && mRes.data) setMilestones(mRes.data.milestones);
    if (meetRes.success && meetRes.data) setMeetings(meetRes.data.meetings);
  }, [room.id]);

  React.useEffect(() => {
    if (activeTab === "deadlines" || activeTab === "meetings") {
      loadMilestonesAndMeetings();
    }
  }, [activeTab, loadMilestonesAndMeetings]);

  const tabs: { id: RoomTab; label: string; badge?: number | string }[] = [
    { id: "members", label: "Members", badge: activeMembers.length },
    { id: "chat", label: "Chat" },
    { id: "tasks", label: "Tasks" },
    { id: "files", label: "Files" },
    { id: "deadlines", label: "Deadlines" },
    { id: "meetings", label: "Meetings" },
    { id: "dashboard", label: "Dashboard" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/rooms" className="hover:text-foreground transition-colors">
              &larr; My Rooms
            </Link>
            <span>/</span>
            <span className="truncate">{title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <Badge variant={isLead ? "accent" : "neutral"}>
              {isLead ? "Team Lead" : isMentor ? "Staff Mentor" : "Team Member"}
            </Badge>
            <Badge variant="neutral">{activeMembers.length} Active Members</Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => setIsLeaveModalOpen(true)}
          >
            Leave Room
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                isActive
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "members" && (
          <MembersTab
            roomId={room.id}
            projectTitle={title}
            currentUserId={currentUserId}
            leadId={room.lead_id}
            members={room.room_members || []}
            pendingTransfer={pendingTransfer}
            events={events}
            onRefresh={onRefresh}
          />
        )}

        {activeTab === "chat" && (
          <ChatTab
            roomId={room.id}
            currentUserId={currentUserId}
            members={room.room_members || []}
            isLead={isLead}
          />
        )}

        {activeTab === "tasks" && (
          <TaskBoardTab
            roomId={room.id}
            currentUserId={currentUserId}
            isLead={isLead}
            canEditTaskBoard={canEditTaskBoard}
            canSetDeadlines={canSetDeadlines}
            members={room.room_members || []}
          />
        )}

        {activeTab === "files" && (
          <FilesTab
            roomId={room.id}
            currentUserId={currentUserId}
            isLead={isLead}
          />
        )}

        {activeTab === "deadlines" && (
          <MilestonesSection
            roomId={room.id}
            milestones={milestones}
            canSetDeadlines={canSetDeadlines}
            onRefresh={loadMilestonesAndMeetings}
          />
        )}

        {activeTab === "meetings" && (
          <MeetingsSection
            roomId={room.id}
            meetings={meetings}
            currentUserId={currentUserId}
            isLead={isLead}
            onRefresh={loadMilestonesAndMeetings}
          />
        )}

        {activeTab === "dashboard" && (
          <ProgressDashboardTab
            roomId={room.id}
            currentUserId={currentUserId}
            isLead={isLead}
            members={room.room_members || []}
          />
        )}
      </div>

      {/* Leave Room Modal */}
      <LeaveRoomModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        isLead={isLead}
        otherMembersCount={otherActiveMembersCount}
        onConfirm={async () => {
          const res = await leaveRoomAction(room.id);
          if (!res.success) {
            throw new Error(res.error || "Failed to leave room.");
          }
          router.push("/rooms");
        }}
      />
    </div>
  );
};
