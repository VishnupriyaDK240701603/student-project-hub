"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge, Button, Avatar } from "@/components/ui";
import { CountdownBadge } from "@/components/invites/CountdownBadge";
import {
  respondToMentorInviteAction,
  type MentorInviteWithDetails,
} from "@/server/actions/mentors";

export interface StaffMentorConsoleClientProps {
  initialInvites: MentorInviteWithDetails[];
}

export const StaffMentorConsoleClient: React.FC<StaffMentorConsoleClientProps> = ({
  initialInvites,
}) => {
  const [invites, setInvites] = useState<MentorInviteWithDetails[]>(initialInvites);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const now = new Date().toISOString();
  const pendingInvites = invites.filter((i) => i.status === "selected" && i.expires_at > now);
  const displayedInvites = tab === "pending" ? pendingInvites : invites;

  const handleRespond = async (inviteId: string, accept: boolean) => {
    setRespondingId(inviteId);
    setActionError(null);
    try {
      const res = await respondToMentorInviteAction(inviteId, accept);
      if (!res.success) {
        setActionError(res.error || "Failed to respond to invitation.");
      } else {
        setInvites((prev) =>
          prev.map((i) =>
            i.id === inviteId
              ? { ...i, status: (res.data?.status as MentorInviteWithDetails["status"]) || (accept ? "accepted" : "rejected") }
              : i,
          ),
        );
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error responding to invitation.");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Staff Mentor Console
            </h1>
            {pendingInvites.length > 0 && (
              <Badge variant="accent" size="sm">
                {pendingInvites.length} Pending
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Review invitations from student project teams. Accepted teams grant advisory room access with chat and dashboard review.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-muted/30 p-1 rounded-lg border border-border">
          <button
            onClick={() => setTab("pending")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "pending"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending ({pendingInvites.length})
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Invitations ({invites.length})
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          {actionError}
        </div>
      )}

      {/* Invites List */}
      {displayedInvites.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {tab === "pending" ? "No Pending Mentor Invitations" : "No Mentor Invitations Recorded"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {tab === "pending"
              ? "You do not have any pending mentorship invitations at this moment."
              : "Invitations sent to you by student project leads will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedInvites.map((invite) => {
            const request = invite.team_requests;
            const inviter = invite.inviter;
            const isPending = invite.status === "selected" && invite.expires_at > now;
            const isAccepted = invite.status === "accepted";
            const isExpired = invite.status === "expired" || (invite.status === "selected" && invite.expires_at <= now);
            const isRejected = invite.status === "rejected";

            return (
              <div
                key={invite.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base text-foreground line-clamp-1">
                      {request?.title || "Project Team"}
                    </h3>
                    {isPending ? (
                      <CountdownBadge expiresAt={invite.expires_at} />
                    ) : (
                      <Badge
                        variant={isAccepted ? "accent" : isRejected ? "danger" : isExpired ? "warning" : "neutral"}
                        size="sm"
                      >
                        {isAccepted ? "Joined as Mentor" : isRejected ? "Declined" : "Expired"}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {request?.description || "No project description provided."}
                  </p>

                  {invite.note && (
                    <div className="p-2.5 rounded bg-muted/30 border border-border/50 text-xs">
                      <span className="font-semibold text-foreground">Note from Lead:</span> &ldquo;{invite.note}&rdquo;
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Avatar name={inviter?.display_name || "Lead"} size="sm" />
                    <span>
                      Invited by <strong>{inviter?.display_name || "Team Lead"}</strong> ({inviter?.department || "Student"})
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Sent {new Date(invite.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>

                  {isPending && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRespond(invite.id, true)}
                        isLoading={respondingId === invite.id}
                        disabled={respondingId !== null}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespond(invite.id, false)}
                        disabled={respondingId !== null}
                      >
                        Decline
                      </Button>
                    </div>
                  )}

                  {isAccepted && invite.room_id && (
                    <Link href={`/rooms/${invite.room_id}`}>
                      <Button size="sm" variant="primary">
                        Enter Room &rarr;
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
