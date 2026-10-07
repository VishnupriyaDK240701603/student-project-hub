"use client";

import React from "react";
import { Avatar, Badge } from "@/components/ui";
import type { TaskWithDetails } from "@/server/actions/tasks";
import type { TaskStatusEnum } from "@/types/database.types";

interface TaskCardProps {
  task: TaskWithDetails;
  currentUserId: string;
  canEdit: boolean;
  onClick: () => void;
  onStatusChange: (taskId: string, status: TaskStatusEnum) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentUserId,
  canEdit,
  onClick,
  onStatusChange,
}) => {
  const isAssignee = task.assignees.some((a) => a.user_id === currentUserId);
  const canChangeStatus = canEdit || isAssignee;

  // Subtask progress
  const totalSubtasks = task.subtasks?.length || 0;
  const doneSubtasks = task.subtasks?.filter((st) => st.status === "done").length || 0;

  // Overdue check
  const isOverdue =
    task.status !== "done" &&
    task.due_date !== null &&
    new Date(task.due_date).getTime() < Date.now();

  const formattedDueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      onClick={onClick}
      className="group relative p-3.5 bg-card/70 hover:bg-card border border-border/80 hover:border-accent/40 rounded-xl transition-all duration-150 shadow-sm hover:shadow cursor-pointer space-y-2.5"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Task: ${task.title}`}
    >
      {/* Title & status selector */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2">
          {task.title}
        </h4>

        {canChangeStatus && (
          <select
            value={task.status}
            onChange={(e) => {
              e.stopPropagation();
              onStatusChange(task.id, e.target.value as TaskStatusEnum);
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-medium bg-muted/60 hover:bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label={`Change status for ${task.title}`}
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        )}
      </div>

      {/* Description preview if present */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Badges & Meta */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-1">
        {/* Due date badge */}
        {formattedDueDate && (
          <Badge
            variant={isOverdue ? "danger" : "neutral"}
            className="text-[10px] px-1.5 py-0.5 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {formattedDueDate}
          </Badge>
        )}

        {/* Subtask count */}
        {totalSubtasks > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
            <svg className="w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {doneSubtasks}/{totalSubtasks}
          </span>
        )}

        {/* Comments count */}
        {task.comments && task.comments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            {task.comments.length}
          </span>
        )}
      </div>

      {/* Assignee Avatars */}
      {task.assignees.length > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div className="flex -space-x-1.5 overflow-hidden">
            {task.assignees.map((assignee) => (
              <Avatar
                key={assignee.user_id}
                name={assignee.profiles?.display_name || "Member"}
                size="sm"
                className="ring-2 ring-background text-[10px]"
              />
            ))}
          </div>
          {isAssignee && (
            <span className="text-[10px] font-medium text-accent">Assigned to you</span>
          )}
        </div>
      )}
    </div>
  );
};
