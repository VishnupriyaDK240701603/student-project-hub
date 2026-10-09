"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Skeleton, Badge, Avatar } from "@/components/ui";
import { getRoomProgressAction } from "@/server/actions/tasks";
import type { TeamProgressSummary, MemberProgressSummary } from "@/lib/tasks-validation";
import type { Profile, RoomMember } from "@/types/database.types";

interface ProgressDashboardTabProps {
  roomId: string;
  currentUserId: string;
  isLead: boolean;
  members: (RoomMember & { profiles: Profile | null })[];
}

export const ProgressDashboardTab: React.FC<ProgressDashboardTabProps> = ({
  roomId,
  currentUserId,
  isLead,
  members,
}) => {
  const [progress, setProgress] = useState<TeamProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await getRoomProgressAction(roomId);
    if (res.success && res.data) {
      setProgress(res.data.progress);
    } else {
      setError(res.error || "Failed to load progress dashboard.");
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
        {error || "Unable to compute progress."}
      </div>
    );
  }

  const teamPct = progress.teamProgressPercentage;
  const isComplete = teamPct === 100 && progress.totalLeafTasks > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Progress Gauge & Formula Explanation */}
      <div className="relative overflow-hidden bg-gradient-to-br from-card via-card/80 to-accent/5 border border-border/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                <span>📊 Realtime Metrics</span>
              </div>
              <button
                type="button"
                onClick={() => loadProgress()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
                title="Refresh metrics"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
            <h2 className="text-xl font-bold text-foreground">Project Deliverables Progress</h2>
            <p className="text-xs text-muted-foreground max-w-lg">
              Progress is calculated strictly across all actionable deliverables using the leaf-item formula:
              <code className="mx-1 px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">
                (Done Leaf Tasks / Total Leaf Tasks) × 100
              </code>
            </p>
          </div>

          {/* Radial Progress Gauge with accessible text fallback */}
          <div className="flex flex-col items-center justify-center relative">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100" role="img" aria-label={`Team progress: ${teamPct} percent`}>
                <title>Team Progress: {teamPct}%</title>
                {/* Background track */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="text-muted/40 stroke-current"
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Progress arc */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={`${
                    isComplete ? "text-emerald-500" : "text-accent"
                  } stroke-current transition-all duration-700 ease-out`}
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - teamPct / 100)}`}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-foreground font-mono">{teamPct}%</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  {isComplete ? "Completed" : "Progress"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Linear Progress Bar for High Accessibility */}
        <div className="mt-6 pt-4 border-t border-border/60">
          <div className="flex justify-between text-xs text-muted-foreground font-medium mb-1.5">
            <span>Overall Completion Status</span>
            <span>{progress.doneLeafTasks} of {progress.totalLeafTasks} tasks completed</span>
          </div>
          <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? "bg-emerald-500" : "bg-accent"
              }`}
              style={{ width: `${teamPct}%` }}
              role="progressbar"
              aria-valuenow={teamPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="p-4 bg-card/60 border border-border/80 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Tasks</span>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono">{progress.totalLeafTasks}</p>
          <p className="text-[11px] text-muted-foreground">Actionable leaf items</p>
        </div>

        {/* Completed */}
        <div className="p-4 bg-card/60 border border-border/80 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{progress.doneLeafTasks}</p>
          <p className="text-[11px] text-muted-foreground">{teamPct}% of total scope</p>
        </div>

        {/* In Progress */}
        <div className="p-4 bg-card/60 border border-border/80 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">In Progress</span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">{progress.inProgressLeafTasks}</p>
          <p className="text-[11px] text-muted-foreground">Currently being worked on</p>
        </div>

        {/* Overdue */}
        <div className="p-4 bg-card/60 border border-border/80 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Overdue</span>
            <span className="w-2 h-2 rounded-full bg-destructive" />
          </div>
          <p className="text-2xl font-bold text-destructive font-mono">{progress.overdueLeafTasks}</p>
          <p className="text-[11px] text-muted-foreground">Past deadline</p>
        </div>
      </div>

      {/* Member Progress Section */}
      <div className="bg-card/40 border border-border/80 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {isLead ? "Team Member Breakdown" : "Your Contribution Breakdown"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isLead
                ? "Individual task completions, active assignments, and overdue items."
                : "Your personal progress across tasks assigned to you in this room."}
            </p>
          </div>
          <Badge variant="neutral" className="text-xs self-start sm:self-auto">
            {progress.membersProgress.length} {progress.membersProgress.length === 1 ? "Member" : "Members"} Tracked
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {progress.membersProgress.map((mp: MemberProgressSummary) => {
            const memberProfile = members.find((m) => m.user_id === mp.userId);
            const isMe = mp.userId === currentUserId;

            return (
              <div
                key={mp.userId}
                className={`p-4 rounded-xl border transition-all ${
                  isMe
                    ? "bg-accent/5 border-accent/30 shadow-sm"
                    : "bg-card border-border/80 hover:border-accent/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={memberProfile?.profiles?.display_name || "Member"}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {memberProfile?.profiles?.display_name || "Member"} {isMe && "(You)"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {memberProfile?.profiles?.department || "Department"} • {memberProfile?.role}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-lg font-bold text-foreground font-mono">{mp.progressPercentage}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted/60 rounded-full h-2 mb-3 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-300"
                    style={{ width: `${mp.progressPercentage}%` }}
                    role="progressbar"
                    aria-valuenow={mp.progressPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-1 text-center text-xs pt-1 border-t border-border/40">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Assigned</span>
                    <span className="font-semibold text-foreground font-mono">{mp.assignedCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Done</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{mp.doneCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 block">Active</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">{mp.inProgressCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-destructive block">Overdue</span>
                    <span className={`font-semibold font-mono ${mp.overdueCount > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                      {mp.overdueCount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
