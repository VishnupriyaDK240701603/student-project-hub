"use client";

import React, { useState } from "react";
import { Button, Input, Badge } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import {
  createMilestoneAction,
  toggleMilestoneAction,
  deleteMilestoneAction,
} from "@/server/actions/tasks";
import type { Milestone } from "@/types/database.types";

interface MilestonesSectionProps {
  roomId: string;
  milestones: Milestone[];
  canSetDeadlines: boolean;
  onRefresh: () => Promise<void>;
}

export const MilestonesSection: React.FC<MilestonesSectionProps> = ({
  roomId,
  milestones,
  canSetDeadlines,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError("Title and due date are required.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await createMilestoneAction(roomId, {
      title: title.trim(),
      due_date: new Date(dueDate).toISOString(),
    });

    if (res.success) {
      setTitle("");
      setDueDate("");
      setIsModalOpen(false);
      await onRefresh();
    } else {
      setError(res.error || "Failed to create milestone.");
    }
    setSaving(false);
  };

  const handleToggle = async (milestoneId: string, currentCompleted: boolean) => {
    if (!canSetDeadlines) return;
    await toggleMilestoneAction(milestoneId, !currentCompleted);
    await onRefresh();
  };

  const handleDelete = async (milestoneId: string) => {
    if (!canSetDeadlines) return;
    if (!confirm("Are you sure you want to delete this milestone?")) return;
    await deleteMilestoneAction(milestoneId);
    await onRefresh();
  };

  return (
    <div className="bg-card/40 border border-border/80 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">Project Milestones</h3>
          <Badge variant="neutral" className="text-xs">
            {milestones.filter((m) => m.is_completed).length}/{milestones.length}
          </Badge>
        </div>

        {canSetDeadlines && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="text-xs h-7"
          >
            + Add Milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No milestones defined yet. {canSetDeadlines && "Add deadlines to track key deliverables."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {milestones.map((m) => {
            const isOverdue =
              !m.is_completed && new Date(m.due_date).getTime() < Date.now();
            const formattedDate = new Date(m.due_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={m.id}
                className={`flex items-start justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                  m.is_completed
                    ? "bg-muted/30 border-border/40 opacity-75"
                    : isOverdue
                    ? "bg-destructive/5 border-destructive/30"
                    : "bg-card border-border hover:border-accent/40"
                }`}
              >
                <label className="flex items-start gap-2 flex-1 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={m.is_completed}
                    disabled={!canSetDeadlines}
                    onChange={() => handleToggle(m.id, m.is_completed)}
                    className="rounded border-border text-accent focus:ring-accent mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium truncate ${
                        m.is_completed
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {m.title}
                    </p>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                      }`}
                    >
                      Due {formattedDate} {isOverdue && "(Overdue)"}
                    </p>
                  </div>
                </label>

                {canSetDeadlines && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                    aria-label={`Delete milestone ${m.title}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Milestone Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Milestone"
        className="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Milestone Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Presentation & Prototype Demo"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Due Date *
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-muted/70 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-accent focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim() || !dueDate}>
              {saving ? "Saving..." : "Add Milestone"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
