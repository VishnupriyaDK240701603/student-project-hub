"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button, Input, Textarea, Avatar } from "@/components/ui";
import { createTaskAction } from "@/server/actions/tasks";
import type { Profile, RoomMember, TaskStatusEnum } from "@/types/database.types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  members: (RoomMember & { profiles: Profile | null })[];
  onCreated: () => Promise<void>;
  defaultStatus?: TaskStatusEnum;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  roomId,
  members,
  onCreated,
  defaultStatus = "todo",
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatusEnum>(defaultStatus);
  const [dueDate, setDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus(defaultStatus);
    setDueDate("");
    setSelectedAssignees([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await createTaskAction(roomId, {
      title: title.trim(),
      description: description.trim() || null,
      status,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      assignee_ids: selectedAssignees,
    });

    if (res.success) {
      resetForm();
      await onCreated();
      onClose();
    } else {
      setError(res.error || "Failed to create task.");
    }
    setSaving(false);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create New Task" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Task Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design authentication workflow"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, notes, or criteria..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Initial Column
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatusEnum)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent focus:outline-none"
            >
              <option value="todo" className="bg-card text-foreground">To do</option>
              <option value="in_progress" className="bg-card text-foreground">In progress</option>
              <option value="done" className="bg-card text-foreground">Done</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Assign To
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1.5 border border-border rounded-lg bg-muted/30">
            {members
              .filter((m) => m.status === "active")
              .map((member) => {
                const isSelected = selectedAssignees.includes(member.user_id);
                return (
                  <button
                    type="button"
                    key={member.user_id}
                    onClick={() => toggleAssignee(member.user_id)}
                    className={`flex items-center gap-2 p-2 rounded-md text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-accent/15 text-accent font-semibold border border-accent/30"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <Avatar name={member.profiles?.display_name || "Member"} size="sm" />
                    <span className="truncate">{member.profiles?.display_name || "User"}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving || !title.trim()}>
            {saving ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
