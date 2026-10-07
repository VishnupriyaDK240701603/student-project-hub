import { describe, it, expect } from "vitest";
import {
  validateTaskInput,
  validateSubtaskHierarchy,
  validateTaskComment,
  validateMilestoneInput,
  validateMeetingInput,
  calculateRoomProgress,
  type TaskWithAssigneesAndSubtasks,
} from "./tasks-validation";

describe("Tasks Validation & Progress Calculation", () => {
  describe("validateTaskInput", () => {
    it("validates valid task input", () => {
      const res = validateTaskInput({
        title: "Setup database schema",
        description: "Configure PostgreSQL tables and indexes",
        status: "todo",
        due_date: "2026-11-01T00:00:00.000Z",
      });

      expect(res.isValid).toBe(true);
      expect(res.sanitizedTitle).toBe("Setup database schema");
      expect(res.sanitizedDescription).toBe("Configure PostgreSQL tables and indexes");
    });

    it("rejects empty title", () => {
      const res = validateTaskInput({ title: "   " });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("required");
    });

    it("rejects title exceeding max length", () => {
      const res = validateTaskInput({ title: "a".repeat(121) });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("cannot exceed 120");
    });

    it("sanitizes HTML in title and description", () => {
      const res = validateTaskInput({
        title: "<b>Build</b> <script>alert(1)</script> API",
        description: "Important: <img src=x onerror=alert(1)>",
      });

      expect(res.isValid).toBe(true);
      expect(res.sanitizedTitle).not.toContain("<script>");
      expect(res.sanitizedDescription).not.toContain("onerror");
    });

    it("rejects invalid due date", () => {
      const res = validateTaskInput({
        title: "Valid Title",
        due_date: "not-a-valid-date",
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Invalid due date");
    });

    it("rejects invalid status", () => {
      const res = validateTaskInput({
        title: "Valid Title",
        // @ts-expect-error test invalid status
        status: "invalid_status",
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Invalid task status");
    });
  });

  describe("validateSubtaskHierarchy", () => {
    it("allows root task (no parent)", () => {
      const res = validateSubtaskHierarchy(null);
      expect(res.isValid).toBe(true);
    });

    it("allows child of a root task (parent has parent_id = null)", () => {
      const res = validateSubtaskHierarchy({ parent_id: null });
      expect(res.isValid).toBe(true);
    });

    it("rejects subtask of a subtask (parent has parent_id !== null)", () => {
      const res = validateSubtaskHierarchy({ parent_id: "parent-task-123" });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("one level of subtasks only");
    });
  });

  describe("validateTaskComment", () => {
    it("validates non-empty comment", () => {
      const res = validateTaskComment("Looks good, PR merged!");
      expect(res.isValid).toBe(true);
      expect(res.sanitizedContent).toBe("Looks good, PR merged!");
    });

    it("rejects empty comment", () => {
      const res = validateTaskComment("   ");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("cannot be empty");
    });

    it("rejects comment exceeding limit", () => {
      const res = validateTaskComment("a".repeat(1001));
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("cannot exceed 1000");
    });
  });

  describe("validateMilestoneInput", () => {
    it("validates valid milestone", () => {
      const res = validateMilestoneInput({
        title: "Alpha Release",
        due_date: "2026-12-15T00:00:00.000Z",
      });
      expect(res.isValid).toBe(true);
      expect(res.sanitizedTitle).toBe("Alpha Release");
    });

    it("rejects invalid due date", () => {
      const res = validateMilestoneInput({
        title: "Alpha",
        due_date: "invalid-date",
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Invalid milestone due date");
    });
  });

  describe("validateMeetingInput", () => {
    it("validates valid meeting", () => {
      const res = validateMeetingInput({
        title: "Sprint Review",
        meeting_link: "https://meet.google.com/abc-defg-hij",
        scheduled_at: "2026-11-10T10:00:00.000Z",
      });
      expect(res.isValid).toBe(true);
      expect(res.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
    });

    it("rejects non-URL meeting link", () => {
      const res = validateMeetingInput({
        title: "Sprint Review",
        meeting_link: "invalid-link",
        scheduled_at: "2026-11-10T10:00:00.000Z",
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("valid");
    });
  });

  describe("calculateRoomProgress (Leaf-item formula)", () => {
    it("calculates 0% when no tasks exist", () => {
      const res = calculateRoomProgress([], ["user-1"]);
      expect(res.totalLeafTasks).toBe(0);
      expect(res.doneLeafTasks).toBe(0);
      expect(res.teamProgressPercentage).toBe(0);
      expect(res.membersProgress[0].progressPercentage).toBe(0);
    });

    it("calculates progress correctly for root tasks with no subtasks", () => {
      // 2 root tasks: Task 1 done, Task 2 todo -> 50%
      const tasks: TaskWithAssigneesAndSubtasks[] = [
        {
          id: "task-1",
          room_id: "room-1",
          parent_id: null,
          title: "Task 1",
          description: null,
          status: "done",
          due_date: null,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-1" }],
        },
        {
          id: "task-2",
          room_id: "room-1",
          parent_id: null,
          title: "Task 2",
          description: null,
          status: "todo",
          due_date: null,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-2" }],
        },
      ];

      const res = calculateRoomProgress(tasks, ["user-1", "user-2"]);
      expect(res.totalLeafTasks).toBe(2);
      expect(res.doneLeafTasks).toBe(1);
      expect(res.teamProgressPercentage).toBe(50);

      // Member 1: 1 assigned, 1 done -> 100%
      const m1 = res.membersProgress.find((m) => m.userId === "user-1");
      expect(m1?.assignedCount).toBe(1);
      expect(m1?.doneCount).toBe(1);
      expect(m1?.progressPercentage).toBe(100);

      // Member 2: 1 assigned, 0 done -> 0%
      const m2 = res.membersProgress.find((m) => m.userId === "user-2");
      expect(m2?.assignedCount).toBe(1);
      expect(m2?.doneCount).toBe(0);
      expect(m2?.progressPercentage).toBe(0);
    });

    it("counts only leaf items when tasks have subtasks (hand-calculated example)", () => {
      // Root task A (parent_id: null) has 2 subtasks: A1 (done), A2 (in_progress).
      // Root task B (parent_id: null) has 0 subtasks: B (todo).
      // Total leaf items = 3 (A1, A2, B). Root task A is NOT a leaf item.
      // Done leaf items = 1 (A1).
      // Team progress = 1 / 3 = 33%.
      const tasks: TaskWithAssigneesAndSubtasks[] = [
        {
          id: "task-A",
          room_id: "room-1",
          parent_id: null,
          title: "Parent Task A",
          description: null,
          status: "in_progress", // Ignored because it has subtasks
          due_date: null,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-1" }],
        },
        {
          id: "task-A1",
          room_id: "room-1",
          parent_id: "task-A",
          title: "Subtask A1",
          description: null,
          status: "done",
          due_date: null,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-1" }],
        },
        {
          id: "task-A2",
          room_id: "room-1",
          parent_id: "task-A",
          title: "Subtask A2",
          description: null,
          status: "in_progress",
          due_date: null,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-2" }],
        },
        {
          id: "task-B",
          room_id: "room-1",
          parent_id: null,
          title: "Root Task B",
          description: null,
          status: "todo",
          due_date: null,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-2" }],
        },
      ];

      const res = calculateRoomProgress(tasks, ["user-1", "user-2"]);
      expect(res.totalLeafTasks).toBe(3);
      expect(res.doneLeafTasks).toBe(1);
      expect(res.inProgressLeafTasks).toBe(1);
      expect(res.todoLeafTasks).toBe(1);
      expect(res.teamProgressPercentage).toBe(33);

      const m1 = res.membersProgress.find((m) => m.userId === "user-1");
      expect(m1?.assignedCount).toBe(1);
      expect(m1?.doneCount).toBe(1);
      expect(m1?.progressPercentage).toBe(100);

      const m2 = res.membersProgress.find((m) => m.userId === "user-2");
      expect(m2?.assignedCount).toBe(2);
      expect(m2?.doneCount).toBe(0);
      expect(m2?.progressPercentage).toBe(0);
    });

    it("correctly identifies overdue tasks", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day from now

      const tasks: TaskWithAssigneesAndSubtasks[] = [
        {
          id: "task-1",
          room_id: "room-1",
          parent_id: null,
          title: "Overdue Task",
          description: null,
          status: "todo",
          due_date: pastDate,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-1" }],
        },
        {
          id: "task-2",
          room_id: "room-1",
          parent_id: null,
          title: "On Track Task",
          description: null,
          status: "todo",
          due_date: futureDate,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-1" }],
        },
        {
          id: "task-3",
          room_id: "room-1",
          parent_id: null,
          title: "Done Task with Past Due Date",
          description: null,
          status: "done",
          due_date: pastDate,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignees: [{ user_id: "user-1" }],
        },
      ];

      const res = calculateRoomProgress(tasks, ["user-1"]);
      expect(res.totalLeafTasks).toBe(3);
      expect(res.overdueLeafTasks).toBe(1); // Only task-1 is overdue (task-3 is done)

      const m1 = res.membersProgress.find((m) => m.userId === "user-1");
      expect(m1?.overdueCount).toBe(1);
    });
  });
});
