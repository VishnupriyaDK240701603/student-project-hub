"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Input, Skeleton, Badge } from "@/components/ui";
import { TaskCard } from "./TaskCard";
import { TaskModal } from "./TaskModal";
import { CreateTaskModal } from "./CreateTaskModal";
import { MilestonesSection } from "./MilestonesSection";
import { MeetingsSection } from "./MeetingsSection";
import {
  getTasksAction,
  getMilestonesAction,
  getMeetingsAction,
  updateTaskStatusAction,
  type TaskWithDetails,
  type MeetingWithCreator,
} from "@/server/actions/tasks";
import type { Profile, RoomMember, Milestone, TaskStatusEnum } from "@/types/database.types";

interface TaskBoardTabProps {
  roomId: string;
  currentUserId: string;
  isLead: boolean;
  canEditTaskBoard: boolean;
  canSetDeadlines: boolean;
  members: (RoomMember & { profiles: Profile | null })[];
}

export const TaskBoardTab: React.FC<TaskBoardTabProps> = ({
  roomId,
  currentUserId,
  isLead,
  canEditTaskBoard,
  canSetDeadlines,
  members,
}) => {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [meetings, setMeetings] = useState<MeetingWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignedToMe, setFilterAssignedToMe] = useState(false);

  // Modals
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatusEnum>("todo");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [tasksRes, milestonesRes, meetingsRes] = await Promise.all([
      getTasksAction(roomId),
      getMilestonesAction(roomId),
      getMeetingsAction(roomId),
    ]);

    if (tasksRes.success && tasksRes.data) {
      setTasks(tasksRes.data.tasks);
    } else {
      setError(tasksRes.error || "Failed to load tasks.");
    }

    if (milestonesRes.success && milestonesRes.data) {
      setMilestones(milestonesRes.data.milestones);
    }

    if (meetingsRes.success && meetingsRes.data) {
      setMeetings(meetingsRes.data.meetings);
    }

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatusEnum) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    const res = await updateTaskStatusAction(taskId, newStatus);
    if (!res.success) {
      await loadData();
    }
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterAssignedToMe) {
        const isAssigned = task.assignees.some((a) => a.user_id === currentUserId);
        if (!isAssigned) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      return true;
    });
  }, [tasks, filterAssignedToMe, searchQuery, currentUserId]);

  // Group into Kanban columns
  const todoTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "todo"),
    [filteredTasks],
  );
  const inProgressTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "in_progress"),
    [filteredTasks],
  );
  const doneTasks = useMemo(
    () => filteredTasks.filter((t) => t.status === "done"),
    [filteredTasks],
  );

  const canEdit = isLead || canEditTaskBoard;
  const canSetDue = isLead || canSetDeadlines;

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Top Collapsible Sections: Milestones & Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MilestonesSection
          roomId={roomId}
          milestones={milestones}
          canSetDeadlines={canSetDue}
          onRefresh={loadData}
        />
        <MeetingsSection
          roomId={roomId}
          meetings={meetings}
          currentUserId={currentUserId}
          isLead={isLead}
          onRefresh={loadData}
        />
      </div>

      {/* Task Board Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="text-xs h-9"
          />
          <Button
            type="button"
            variant={filterAssignedToMe ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilterAssignedToMe(!filterAssignedToMe)}
            className="text-xs h-9 whitespace-nowrap"
          >
            My Tasks
          </Button>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setCreateDefaultStatus("todo");
              setIsCreateModalOpen(true);
            }}
            className="text-xs h-9 font-medium"
          >
            + New Task
          </Button>
        )}
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[450px]">
        {/* TO DO Column */}
        <div className="flex flex-col bg-muted/20 border border-border/70 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h3 className="text-sm font-semibold text-foreground">To do</h3>
              <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                {todoTasks.length}
              </Badge>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setCreateDefaultStatus("todo");
                  setIsCreateModalOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground text-xs p-1"
                aria-label="Add task to To do"
              >
                +
              </button>
            )}
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {todoTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                No tasks to do
              </p>
            ) : (
              todoTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  currentUserId={currentUserId}
                  canEdit={canEdit}
                  onClick={() => setSelectedTask(t)}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
          </div>
        </div>

        {/* IN PROGRESS Column */}
        <div className="flex flex-col bg-muted/20 border border-border/70 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-sm font-semibold text-foreground">In progress</h3>
              <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                {inProgressTasks.length}
              </Badge>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setCreateDefaultStatus("in_progress");
                  setIsCreateModalOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground text-xs p-1"
                aria-label="Add task to In progress"
              >
                +
              </button>
            )}
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {inProgressTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                No tasks in progress
              </p>
            ) : (
              inProgressTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  currentUserId={currentUserId}
                  canEdit={canEdit}
                  onClick={() => setSelectedTask(t)}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
          </div>
        </div>

        {/* DONE Column */}
        <div className="flex flex-col bg-muted/20 border border-border/70 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Done</h3>
              <Badge variant="neutral" className="text-[10px] px-1.5 py-0">
                {doneTasks.length}
              </Badge>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setCreateDefaultStatus("done");
                  setIsCreateModalOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground text-xs p-1"
                aria-label="Add task to Done"
              >
                +
              </button>
            )}
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {doneTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                No tasks completed yet
              </p>
            ) : (
              doneTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  currentUserId={currentUserId}
                  canEdit={canEdit}
                  onClick={() => setSelectedTask(t)}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <TaskModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        roomId={roomId}
        currentUserId={currentUserId}
        canEdit={canEdit}
        members={members}
        onRefresh={loadData}
      />

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        roomId={roomId}
        members={members}
        onCreated={loadData}
        defaultStatus={createDefaultStatus}
      />
    </div>
  );
};
