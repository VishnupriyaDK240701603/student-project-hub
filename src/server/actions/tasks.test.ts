import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockFrom = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "user-test-1", email: "2024cs01@rajlakshmi.edu.in" } },
  error: null,
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: undefined;
}

function createMockChain(data: unknown = null, error: unknown = null): MockChain {
  const chain: Partial<MockChain> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  chain.then = undefined;
  return chain as MockChain;
}

describe("Tasks Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTaskAction", () => {
    it("rejects task creation if user lacks edit_task_board permission", async () => {
      // Room member without can_edit_task_board
      const memberChain = createMockChain({
        role: "member",
        status: "active",
        can_edit_task_board: false,
        can_set_deadlines: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const { createTaskAction } = await import("./tasks");
      const result = await createTaskAction("room-1", {
        title: "New feature",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("permission to create tasks");
    });

    it("allows task creation if user is lead or has permission", async () => {
      const memberChain = createMockChain({
        role: "lead",
        status: "active",
        can_edit_task_board: true,
        can_set_deadlines: true,
      });

      const insertChain = createMockChain({
        id: "task-new",
        room_id: "room-1",
        title: "New feature",
        status: "todo",
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "tasks") return insertChain;
        return createMockChain();
      });

      const { createTaskAction } = await import("./tasks");
      const result = await createTaskAction("room-1", {
        title: "New feature",
      });

      expect(result.success).toBe(true);
      expect(result.data?.task.title).toBe("New feature");
    });

    it("rejects creating a subtask under another subtask (single-level hierarchy enforcement)", async () => {
      const memberChain = createMockChain({
        role: "lead",
        status: "active",
        can_edit_task_board: true,
        can_set_deadlines: true,
      });

      // Parent task already has a parent_id (it is a subtask)
      const parentTaskChain = createMockChain({
        id: "subtask-1",
        room_id: "room-1",
        parent_id: "root-task-1",
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "tasks") return parentTaskChain;
        return createMockChain();
      });

      const { createTaskAction } = await import("./tasks");
      const result = await createTaskAction("room-1", {
        title: "Nested subtask",
        parent_id: "subtask-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("one level of subtasks only");
    });
  });

  describe("updateTaskStatusAction", () => {
    it("allows assignee to update task status even without edit_task_board permission (Rule D7)", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
        can_edit_task_board: false,
        can_set_deadlines: false,
      });

      // Task where current user is in assignees list
      const taskChain = createMockChain({
        id: "task-1",
        room_id: "room-1",
        status: "todo",
        assignees: [{ user_id: "user-test-1" }],
      });

      const updateChain = createMockChain({
        id: "task-1",
        status: "done",
      });

      let taskCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "tasks") {
          taskCall++;
          return taskCall === 1 ? taskChain : updateChain;
        }
        return createMockChain();
      });

      const { updateTaskStatusAction } = await import("./tasks");
      const result = await updateTaskStatusAction("task-1", "done");

      expect(result.success).toBe(true);
      expect(result.data?.task.status).toBe("done");
    });

    it("rejects non-assignee without permission from updating status", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
        can_edit_task_board: false,
        can_set_deadlines: false,
      });

      // Task assigned to someone else
      const taskChain = createMockChain({
        id: "task-1",
        room_id: "room-1",
        status: "todo",
        assignees: [{ user_id: "user-other" }],
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "tasks") return taskChain;
        return createMockChain();
      });

      const { updateTaskStatusAction } = await import("./tasks");
      const result = await updateTaskStatusAction("task-1", "done");

      expect(result.success).toBe(false);
      expect(result.error).toContain("only update the status of tasks assigned to you");
    });
  });

  describe("createMilestoneAction", () => {
    it("rejects milestone creation if user lacks set_deadlines permission", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
        can_edit_task_board: true,
        can_set_deadlines: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const { createMilestoneAction } = await import("./tasks");
      const result = await createMilestoneAction("room-1", {
        title: "Beta Launch",
        due_date: "2026-11-20T00:00:00.000Z",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("permission to set deadlines");
    });
  });

  describe("deleteMeetingAction", () => {
    it("allows meeting creator to delete the meeting", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
      });

      const meetingChain = createMockChain({
        id: "meeting-1",
        room_id: "room-1",
        created_by: "user-test-1", // Same as logged in user
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "meetings") return meetingChain;
        return createMockChain();
      });

      const { deleteMeetingAction } = await import("./tasks");
      const result = await deleteMeetingAction("meeting-1");

      expect(result.success).toBe(true);
    });

    it("prevents non-creator non-lead from deleting meeting", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
      });

      const meetingChain = createMockChain({
        id: "meeting-1",
        room_id: "room-1",
        created_by: "user-other", // Different user
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "meetings") return meetingChain;
        return createMockChain();
      });

      const { deleteMeetingAction } = await import("./tasks");
      const result = await deleteMeetingAction("meeting-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("creator or the room lead");
    });
  });

  describe("getRoomProgressAction (Privacy protection)", () => {
    it("filters out other members' progress for regular members", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
      });

      // Active members in room
      const membersListChain = createMockChain();
      membersListChain.eq = vi.fn().mockReturnValue({
        ...membersListChain,
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: "user-test-1" }, { user_id: "user-2" }, { user_id: "user-3" }],
          error: null,
        }),
      });

      // Tasks
      const tasksChain = createMockChain();
      tasksChain.eq = vi.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            room_id: "room-1",
            parent_id: null,
            title: "Task 1",
            status: "done",
            due_date: null,
            assignees: [{ user_id: "user-test-1" }],
          },
          {
            id: "task-2",
            room_id: "room-1",
            parent_id: null,
            title: "Task 2",
            status: "todo",
            due_date: null,
            assignees: [{ user_id: "user-2" }],
          },
        ],
        error: null,
      });

      let rmCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") {
          rmCount++;
          return rmCount === 1 ? memberChain : membersListChain;
        }
        if (table === "tasks") return tasksChain;
        return createMockChain();
      });

      const { getRoomProgressAction } = await import("./tasks");
      const result = await getRoomProgressAction("room-1");

      expect(result.success).toBe(true);
      expect(result.data?.progress.teamProgressPercentage).toBe(50);
      // Privacy check: only user-test-1 in membersProgress
      expect(result.data?.progress.membersProgress.length).toBe(1);
      expect(result.data?.progress.membersProgress[0].userId).toBe("user-test-1");
    });

    it("returns all members' individual progress for team lead", async () => {
      const memberChain = createMockChain({
        role: "lead",
        status: "active",
      });

      const membersListChain = createMockChain();
      membersListChain.eq = vi.fn().mockReturnValue({
        ...membersListChain,
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: "user-test-1" }, { user_id: "user-2" }],
          error: null,
        }),
      });

      const tasksChain = createMockChain();
      tasksChain.eq = vi.fn().mockResolvedValue({
        data: [
          {
            id: "task-1",
            room_id: "room-1",
            parent_id: null,
            title: "Task 1",
            status: "done",
            due_date: null,
            assignees: [{ user_id: "user-test-1" }],
          },
        ],
        error: null,
      });

      let rmCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") {
          rmCount++;
          return rmCount === 1 ? memberChain : membersListChain;
        }
        if (table === "tasks") return tasksChain;
        return createMockChain();
      });

      const { getRoomProgressAction } = await import("./tasks");
      const result = await getRoomProgressAction("room-1");

      expect(result.success).toBe(true);
      // Team lead sees all members
      expect(result.data?.progress.membersProgress.length).toBe(2);
    });
  });
});
