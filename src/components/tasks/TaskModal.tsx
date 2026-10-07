"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button, Input, Textarea, Badge, Avatar } from "@/components/ui";
import {
  updateTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  addTaskCommentAction,
  createTaskAction,
  type TaskWithDetails,
} from "@/server/actions/tasks";
import type { Profile, RoomMember, TaskStatusEnum } from "@/types/database.types";

interface TaskModalProps {
  task: TaskWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserId: string;
  canEdit: boolean;
  members: (RoomMember & { profiles: Profile | null })[];
  onRefresh: () => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  onClose,
  roomId,
  currentUserId,
  canEdit,
  members,
  onRefresh,
}) => {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<TaskStatusEnum>(task?.status || "todo");
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.slice(0, 10) : "");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    task?.assignees.map((a) => a.user_id) || [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subtask form state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Sync state when task prop changes
  React.useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
      setSelectedAssignees(task.assignees.map((a) => a.user_id));
      setError(null);
    }
  }, [task]);

  if (!task) return null;

  const isAssignee = task.assignees.some((a) => a.user_id === currentUserId);
  const canChangeStatus = canEdit || isAssignee;
  const isSubtask = task.parent_id !== null;

  // Save task details
  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError(null);

    const res = await updateTaskAction(task.id, {
      title,
      description,
      status,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      assignee_ids: selectedAssignees,
    });

    if (res.success) {
      await onRefresh();
      onClose();
    } else {
      setError(res.error || "Failed to update task.");
    }
    setSaving(false);
  };

  // Quick status change for assignees without full edit rights
  const handleStatusOnlyChange = async (newStatus: TaskStatusEnum) => {
    setStatus(newStatus);
    const res = await updateTaskStatusAction(task.id, newStatus);
    if (res.success) {
      await onRefresh();
    } else {
      setError(res.error || "Failed to update status.");
    }
  };

  // Delete task
  const handleDelete = async () => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this task? All subtasks will also be deleted.")) {
      return;
    }
    setSaving(true);
    const res = await deleteTaskAction(task.id);
    if (res.success) {
      await onRefresh();
      onClose();
    } else {
      setError(res.error || "Failed to delete task.");
    }
    setSaving(false);
  };

  // Add subtask
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !canEdit || isSubtask) return;

    setAddingSubtask(true);
    setError(null);

    const res = await createTaskAction(roomId, {
      title: newSubtaskTitle.trim(),
      parent_id: task.id,
      status: "todo",
    });

    if (res.success) {
      setNewSubtaskTitle("");
      await onRefresh();
    } else {
      setError(res.error || "Failed to add subtask.");
    }
    setAddingSubtask(false);
  };

  // Toggle subtask status
  const handleToggleSubtask = async (subtaskId: string, currentSubtaskStatus: TaskStatusEnum) => {
    const nextStatus: TaskStatusEnum = currentSubtaskStatus === "done" ? "todo" : "done";
    const res = await updateTaskStatusAction(subtaskId, nextStatus);
    if (res.success) {
      await onRefresh();
    }
  };

  // Post comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setPostingComment(true);
    setError(null);

    const res = await addTaskCommentAction(task.id, commentText.trim());
    if (res.success) {
      setCommentText("");
      await onRefresh();
    } else {
      setError(res.error || "Failed to post comment.");
    }
    setPostingComment(false);
  };

  // Toggle assignee checkbox
  const toggleAssignee = (userId: string) => {
    if (!canEdit) return;
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isSubtask ? "Subtask Details" : "Task Details"}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6 pt-2">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Header: Title & Status */}
        <div className="space-y-3">
          {canEdit ? (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="font-medium"
              />
            </div>
          ) : (
            <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Status
              </label>
              {canChangeStatus ? (
                <select
                  value={status}
                  onChange={(e) => {
                    const newStatus = e.target.value as TaskStatusEnum;
                    if (canEdit) {
                      setStatus(newStatus);
                    } else {
                      handleStatusOnlyChange(newStatus);
                    }
                  }}
                  className="bg-muted/70 border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground focus:ring-1 focus:ring-accent focus:outline-none"
                  aria-label="Task status"
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              ) : (
                <Badge variant={status === "done" ? "success" : "neutral"}>
                  {status === "in_progress" ? "In progress" : status === "done" ? "Done" : "To do"}
                </Badge>
              )}
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Due Date
              </label>
              {canEdit ? (
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-muted/70 border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground focus:ring-1 focus:ring-accent focus:outline-none"
                  aria-label="Due date"
                />
              ) : (
                <span className="text-sm text-foreground">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : "No deadline"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Description
          </label>
          {canEdit ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, acceptance criteria, or notes..."
              rows={3}
            />
          ) : (
            <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-border/40">
              {task.description || "No description provided."}
            </p>
          )}
        </div>

        {/* Assignees */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Assignees
          </label>
          {canEdit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 border rounded-lg bg-muted/20">
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
                          ? "bg-accent/15 text-accent font-medium border border-accent/30"
                          : "hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by button onClick
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      <Avatar name={member.profiles?.display_name || "Member"} size="sm" />
                      <span className="truncate">{member.profiles?.display_name || "User"}</span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {task.assignees.length > 0 ? (
                task.assignees.map((a) => (
                  <Badge key={a.user_id} variant="neutral" className="flex items-center gap-1.5 py-1">
                    <Avatar name={a.profiles?.display_name || "Member"} size="sm" />
                    <span>{a.profiles?.display_name || "Member"}</span>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No assignees</span>
              )}
            </div>
          )}
        </div>

        {/* Subtasks Section (Only shown if current task is a root task) */}
        {!isSubtask && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Subtasks ({task.subtasks?.filter((st) => st.status === "done").length || 0}/
                {task.subtasks?.length || 0})
              </label>
            </div>

            {/* Subtask checklist */}
            <div className="space-y-1.5">
              {(task.subtasks || []).map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/60 hover:border-accent/30 text-xs"
                >
                  <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subtask.status === "done"}
                      onChange={() => handleToggleSubtask(subtask.id, subtask.status)}
                      className="rounded border-border text-accent focus:ring-accent w-4 h-4"
                    />
                    <span
                      className={
                        subtask.status === "done"
                          ? "line-through text-muted-foreground"
                          : "text-foreground font-medium"
                      }
                    >
                      {subtask.title}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            {/* Add subtask input (one level only) */}
            {canEdit && (
              <form onSubmit={handleAddSubtask} className="flex gap-2">
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Add a subtask..."
                  className="text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={addingSubtask || !newSubtaskTitle.trim()}
                >
                  {addingSubtask ? "Adding..." : "+ Add"}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Comments Section */}
        <div className="space-y-3 pt-2 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Discussion & Activity ({task.comments?.length || 0})
          </label>

          {/* Comments list */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {(task.comments || []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No comments yet.</p>
            ) : (
              (task.comments || []).map((c) => (
                <div key={c.id} className="p-2.5 bg-muted/30 rounded-lg text-xs space-y-1 border border-border/40">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {c.profiles?.display_name || "Member"}
                    </span>
                    <span className="text-[10px]">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{c.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={postingComment || !commentText.trim()}
            >
              {postingComment ? "Posting..." : "Comment"}
            </Button>
          </form>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {canEdit ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete Task
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && (
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
