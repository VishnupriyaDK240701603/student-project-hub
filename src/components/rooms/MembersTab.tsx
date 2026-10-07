"use client";

import React, { useState } from "react";
import { Avatar, Badge, Button } from "@/components/ui";
import { RemoveMemberModal } from "./RemoveMemberModal";
import { LeadSwapModal } from "./LeadSwapModal";
import { ReAddMemberModal } from "./ReAddMemberModal";
import { RoomEventsFeed } from "./RoomEventsFeed";
import { InviteMentorModal } from "@/components/mentors/InviteMentorModal";
import {
  updateMemberPermissionsAction,
  offerLeadSwapAction,
  requestLeadSwapAction,
  respondToLeadSwapAction,
  removeMemberAction,
  reAddMemberAction,
  type RoomEventWithActor,
} from "@/server/actions/room-management";
import type { RoomMember, Profile, LeadTransfer } from "@/types/database.types";

export interface MembersTabProps {
  roomId: string;
  projectTitle?: string;
  currentUserId: string;
  leadId: string;
  members: (RoomMember & { profiles: Profile | null })[];
  pendingTransfer: LeadTransfer | null;
  events: RoomEventWithActor[];
  onRefresh: () => Promise<void>;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  roomId,
  projectTitle = "Project Room",
  currentUserId,
  leadId,
  members,
  pendingTransfer,
  events,
  onRefresh,
}) => {
  const [isInviteMentorOpen, setIsInviteMentorOpen] = useState(false);
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [swapModalState, setSwapModalState] = useState<{
    isOpen: boolean;
    flow: "offer" | "request";
    targetMember?: { id: string; name: string };
  }>({ isOpen: false, flow: "offer" });

  const [isReAddOpen, setIsReAddOpen] = useState(false);
  const [savingPermissionsId, setSavingPermissionsId] = useState<string | null>(null);
  const [respondingSwap, setRespondingSwap] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isCurrentLead = currentUserId === leadId;
  const currentMember = members.find((m) => m.user_id === currentUserId);
  const canReAdd = isCurrentLead || Boolean(currentMember?.can_invite_mentors);

  // Active members only
  const activeMembers = members.filter((m) => m.status === "active");

  const handlePermissionToggle = async (
    targetUserId: string,
    permissionKey: "can_edit_tasks" | "can_set_deadlines" | "can_invite_mentors",
    currentValue: boolean,
  ) => {
    if (!isCurrentLead) return;

    setSavingPermissionsId(targetUserId);
    setActionError(null);
    try {
      const target = members.find((m) => m.user_id === targetUserId);
      if (!target) return;

      const newPermissions = {
        can_edit_tasks: permissionKey === "can_edit_tasks" ? !currentValue : target.can_edit_tasks,
        can_set_deadlines:
          permissionKey === "can_set_deadlines" ? !currentValue : target.can_set_deadlines,
        can_invite_mentors:
          permissionKey === "can_invite_mentors" ? !currentValue : target.can_invite_mentors,
      };

      const res = await updateMemberPermissionsAction(roomId, targetUserId, newPermissions);
      if (!res.success) {
        setActionError(res.error || "Failed to update permissions.");
      } else {
        await onRefresh();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error updating permissions.");
    } finally {
      setSavingPermissionsId(null);
    }
  };

  const handleRespondToSwap = async (accept: boolean) => {
    if (!pendingTransfer) return;
    setRespondingSwap(true);
    setActionError(null);
    try {
      const res = await respondToLeadSwapAction(pendingTransfer.id, accept);
      if (!res.success) {
        setActionError(res.error || "Failed to respond to leadership swap.");
      } else {
        await onRefresh();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error responding to swap.");
    } finally {
      setRespondingSwap(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Baseline permissions notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div>
          <h2 className="text-sm font-semibold text-primary">Baseline Permissions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All team members can always chat, use @ai, and upload files. The team lead configures task board, deadline, and mentor invite permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isCurrentLead || Boolean(currentMember?.can_invite_mentors)) && (
            <Button size="sm" variant="primary" onClick={() => setIsInviteMentorOpen(true)}>
              Invite Mentor
            </Button>
          )}
          {canReAdd && (
            <Button size="sm" variant="outline" onClick={() => setIsReAddOpen(true)}>
              Re-add Past Member
            </Button>
          )}
          {!isCurrentLead && currentMember?.role !== "mentor" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSwapModalState({ isOpen: true, flow: "request" })}
            >
              Request Leadership
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Pending Lead Transfer Banner */}
      {pendingTransfer && (
        <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                Leadership Transfer Pending
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingTransfer.status === "selected" && pendingTransfer.target_lead_id === currentUserId && (
                  <span>The team lead has offered you leadership of this room. Do you accept?</span>
                )}
                {pendingTransfer.status === "applied" && pendingTransfer.current_lead_id === currentUserId && (
                  <span>A teammate has requested leadership of this room. Review and decide:</span>
                )}
                {pendingTransfer.current_lead_id === currentUserId && pendingTransfer.status === "selected" && (
                  <span>You offered leadership to a teammate. Waiting for their response.</span>
                )}
                {pendingTransfer.target_lead_id === currentUserId && pendingTransfer.status === "applied" && (
                  <span>Your request to assume leadership is pending review by the lead.</span>
                )}
              </p>
            </div>
            {((pendingTransfer.status === "selected" && pendingTransfer.target_lead_id === currentUserId) ||
              (pendingTransfer.status === "applied" && pendingTransfer.current_lead_id === currentUserId)) && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleRespondToSwap(true)}
                  isLoading={respondingSwap}
                >
                  Accept & Swap
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRespondToSwap(false)}
                  disabled={respondingSwap}
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Active Team Members ({activeMembers.length})
        </h3>
        <div className="divide-y divide-border border rounded-xl bg-card overflow-hidden">
          {activeMembers.map((member) => {
            const isLead = member.user_id === leadId;
            const isSelf = member.user_id === currentUserId;
            const profile = member.profiles;
            const isSaving = savingPermissionsId === member.user_id;

            return (
              <div
                key={member.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Member Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={profile?.display_name || "User"} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm truncate">
                        {profile?.display_name || "Team Member"}
                      </span>
                      {isSelf && (
                        <Badge variant="neutral" size="sm">
                          You
                        </Badge>
                      )}
                      <Badge
                        variant={isLead ? "accent" : "neutral"}
                        size="sm"
                      >
                        {isLead ? "Lead" : member.role === "mentor" ? "Staff Mentor" : "Member"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {profile?.department || "Department"}
                      {profile?.admission_year ? ` · Year ${profile.admission_year}` : ""}
                    </p>
                  </div>
                </div>

                {/* Permissions & Controls */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  {/* Permissions Toggles (Lead configuring student members) */}
                  {isCurrentLead && !isLead && member.role !== "mentor" ? (
                    <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border/50">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={member.can_edit_tasks}
                          disabled={isSaving}
                          onChange={() =>
                            handlePermissionToggle(
                              member.user_id,
                              "can_edit_tasks",
                              member.can_edit_tasks,
                            )
                          }
                          className="rounded border-input text-primary focus:ring-accent"
                        />
                        <span>Tasks</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={member.can_set_deadlines}
                          disabled={isSaving}
                          onChange={() =>
                            handlePermissionToggle(
                              member.user_id,
                              "can_set_deadlines",
                              member.can_set_deadlines,
                            )
                          }
                          className="rounded border-input text-primary focus:ring-accent"
                        />
                        <span>Deadlines</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={member.can_invite_mentors}
                          disabled={isSaving}
                          onChange={() =>
                            handlePermissionToggle(
                              member.user_id,
                              "can_invite_mentors",
                              member.can_invite_mentors,
                            )
                          }
                          className="rounded border-input text-primary focus:ring-accent"
                        />
                        <span>Re-add / Mentors</span>
                      </label>
                    </div>
                  ) : (
                    /* Read-only permission badges for non-leads or mentors */
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {isLead ? (
                        <span className="text-xs text-accent font-medium">All Permissions (Lead)</span>
                      ) : member.role === "mentor" ? (
                        <span className="text-xs text-muted-foreground">Advisory & Chat</span>
                      ) : (
                        <div className="flex gap-1.5">
                          {member.can_edit_tasks && <Badge variant="neutral" size="sm">Tasks</Badge>}
                          {member.can_set_deadlines && <Badge variant="neutral" size="sm">Deadlines</Badge>}
                          {member.can_invite_mentors && <Badge variant="neutral" size="sm">Mentors</Badge>}
                          {!member.can_edit_tasks && !member.can_set_deadlines && !member.can_invite_mentors && (
                            <span className="text-xs text-muted-foreground">Chat & Uploads</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions (Offer Lead or Remove Member) */}
                  {isCurrentLead && !isLead && member.role !== "mentor" && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSwapModalState({
                            isOpen: true,
                            flow: "offer",
                            targetMember: {
                              id: member.user_id,
                              name: profile?.display_name || "Teammate",
                            },
                          })
                        }
                      >
                        Offer Lead
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setSelectedMemberForRemoval({
                            id: member.user_id,
                            name: profile?.display_name || "Teammate",
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Room Events Feed */}
      <RoomEventsFeed events={events} />

      {/* Modals */}
      {selectedMemberForRemoval && (
        <RemoveMemberModal
          isOpen={true}
          onClose={() => setSelectedMemberForRemoval(null)}
          memberId={selectedMemberForRemoval.id}
          memberName={selectedMemberForRemoval.name}
          onConfirm={async (reason) => {
            const res = await removeMemberAction(roomId, selectedMemberForRemoval.id, reason);
            if (!res.success) {
              throw new Error(res.error || "Failed to remove member.");
            }
            await onRefresh();
          }}
        />
      )}

      {swapModalState.isOpen && (
        <LeadSwapModal
          isOpen={true}
          flow={swapModalState.flow}
          targetMemberName={swapModalState.targetMember?.name}
          onClose={() => setSwapModalState({ isOpen: false, flow: "offer" })}
          onConfirm={async () => {
            if (swapModalState.flow === "offer" && swapModalState.targetMember) {
              const res = await offerLeadSwapAction(roomId, swapModalState.targetMember.id);
              if (!res.success) throw new Error(res.error || "Failed to offer leadership.");
            } else if (swapModalState.flow === "request") {
              const res = await requestLeadSwapAction(roomId);
              if (!res.success) throw new Error(res.error || "Failed to request leadership.");
            }
            await onRefresh();
          }}
        />
      )}

      {isReAddOpen && (
        <ReAddMemberModal
          isOpen={true}
          roomId={roomId}
          onClose={() => setIsReAddOpen(false)}
          onConfirm={async (targetUserId) => {
            const res = await reAddMemberAction(roomId, targetUserId);
            if (!res.success) throw new Error(res.error || "Failed to re-add member.");
            await onRefresh();
          }}
        />
      )}

      {isInviteMentorOpen && (
        <InviteMentorModal
          isOpen={true}
          roomId={roomId}
          projectTitle={projectTitle}
          onClose={() => setIsInviteMentorOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
};
