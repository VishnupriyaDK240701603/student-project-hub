"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { MembersTab } from "./MembersTab";
import { LeaveRoomModal } from "./LeaveRoomModal";
import { ChatTab } from "@/components/chat/ChatTab";
import { FilesTab } from "@/components/chat/FilesTab";
import { leaveRoomAction, type RoomEventWithActor } from "@/server/actions/room-management";
import type { Room, TeamRequest, RoomMember, Profile, LeadTransfer } from "@/types/database.types";

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

  const title = room.team_requests?.title || "Project Room";
  const isLead = room.lead_id === currentUserId;
  const activeMembers = (room.room_members || []).filter((m) => m.status === "active");
  const otherActiveMembersCount = activeMembers.filter((m) => m.user_id !== currentUserId).length;

  const currentMember = (room.room_members || []).find((m) => m.user_id === currentUserId);
  const isMentor = currentMember?.role === "mentor";

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
          <div className="p-12 text-center border rounded-xl bg-card/50 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-semibold">Task Board & Milestones</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Interactive Kanban board (To do, In progress, Done), subtasks, assignees, and attachments (configured in Prompt 15).
            </p>
          </div>
        )}

        {activeTab === "files" && (
          <FilesTab
            roomId={room.id}
            currentUserId={currentUserId}
            isLead={isLead}
          />
        )}

        {activeTab === "deadlines" && (
          <div className="p-12 text-center border rounded-xl bg-card/50 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold">Deadlines & Deliverables</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Track project milestones and review deadlines with countdowns and alerts (configured in Prompt 15).
            </p>
          </div>
        )}

        {activeTab === "meetings" && (
          <div className="p-12 text-center border rounded-xl bg-card/50 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold">Team Meetings & Video Calls</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Schedule team syncs and mentor advisory meetings with meeting links (configured in Prompt 15).
            </p>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="p-12 text-center border rounded-xl bg-card/50 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold">Project Progress Dashboard</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Individual and team completion rates with accessible charts (configured in Prompt 15).
            </p>
          </div>
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
