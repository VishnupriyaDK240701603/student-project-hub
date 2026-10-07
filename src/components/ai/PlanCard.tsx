"use client";

import React, { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { confirmAiPlanAction } from "@/server/actions/ai";
import type { AiPlanProposal } from "@/lib/ai/plan-schema";

interface PlanCardProps {
  plan: AiPlanProposal;
  roomId: string;
  canEditTasks: boolean;
  onConfirmed?: () => void;
  onDismiss?: () => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  roomId,
  canEditTasks,
  onConfirmed,
  onDismiss,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalTasks = plan.tasks.length;
  const totalSubtasks = plan.tasks.reduce(
    (acc, t) => acc + (t.subtasks?.length || 0),
    0,
  );

  const handleConfirm = async () => {
    if (!canEditTasks || confirming) return;
    setConfirming(true);
    setError(null);

    const res = await confirmAiPlanAction(roomId, plan);
    if (res.success) {
      setConfirmed(true);
      onConfirmed?.();
    } else {
      setError(res.error || "Failed to add tasks to the board.");
    }
    setConfirming(false);
  };

  if (confirmed) {
    return (
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Plan confirmed & tasks added to Task Board!</span>
        </div>
        <p className="text-muted-foreground">
          {totalTasks} tasks and {totalSubtasks} subtasks were successfully created.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card/80 border border-accent/40 rounded-xl p-4 space-y-3.5 shadow-sm text-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="accent" className="text-[10px]">
              🤖 Suggested Project Plan
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {totalTasks} tasks {totalSubtasks > 0 && `• ${totalSubtasks} subtasks`}
            </span>
          </div>
          <h4 className="text-sm font-bold text-foreground">{plan.title}</h4>
          {plan.summary && (
            <p className="text-xs text-muted-foreground mt-0.5">{plan.summary}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Task Preview List */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {plan.tasks.map((task, idx) => (
          <div
            key={idx}
            className="p-2.5 bg-muted/40 rounded-lg border border-border/60 space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="font-semibold text-foreground">{task.title}</span>
            </div>
            {task.description && (
              <p className="text-[11px] text-muted-foreground pl-3.5">
                {task.description}
              </p>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="pl-3.5 pt-1 space-y-0.5">
                {task.subtasks.map((sub, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span className="text-muted-foreground/60">•</span>
                    <span>{sub.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        {!canEditTasks ? (
          <span className="text-[11px] text-muted-foreground italic">
            Only team leads or members with task board permission can confirm this plan.
          </span>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 ml-auto">
          {onDismiss && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDismiss}
              className="text-xs h-7"
            >
              Dismiss
            </Button>
          )}
          {canEditTasks && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={confirming}
              className="text-xs h-7 font-medium"
            >
              {confirming ? "Creating Tasks..." : "Confirm Plan & Add Tasks"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
