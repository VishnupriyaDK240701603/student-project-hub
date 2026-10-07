import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AiProvider } from "@/lib/ai/provider";

// Mock Supabase server client
const mockFrom = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "user-ai-test-1", email: "2024cs01@rajlakshmi.edu.in" } },
  error: null,
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
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
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  chain.then = undefined;
  return chain as MockChain;
}

describe("AI Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("askRoomAiAction", () => {
    it("rejects non-members from asking AI", async () => {
      const memberChain = createMockChain(null); // No membership

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const { askRoomAiAction } = await import("./ai");
      const result = await askRoomAiAction("room-1", "Help with tasks");

      expect(result.success).toBe(false);
      expect(result.error).toContain("active room member");
    });

    it("rejects when daily limit of 20 queries is reached", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
      });

      // Usage row showing 20 queries used today
      const usageChain = createMockChain({
        query_count: 20,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "ai_usage") return usageChain;
        return createMockChain();
      });

      const { askRoomAiAction } = await import("./ai");
      // Provide custom provider so AI_ENABLED check passes
      const mockProvider: AiProvider = {
        generate: vi.fn().mockResolvedValue({ text: "Answer" }),
      };

      const result = await askRoomAiAction("room-1", "Query #21", mockProvider);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Daily AI limit reached");
    });

    it("returns disabled notice when AI_ENABLED is false and no custom provider", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const origEnv = process.env.AI_ENABLED;
      process.env.AI_ENABLED = "false";

      const { askRoomAiAction } = await import("./ai");
      const result = await askRoomAiAction("room-1", "Hello");

      expect(result.success).toBe(true);
      expect(result.data?.cleanText).toContain("disabled by the college administrator");

      process.env.AI_ENABLED = origEnv;
    });

    it("executes query and returns parsed response with custom provider", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
      });

      const usageChain = createMockChain({
        query_count: 5,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "ai_usage") return usageChain;
        return createMockChain();
      });

      const mockProvider: AiProvider = {
        generate: vi.fn().mockResolvedValue({
          text: "Here are some recommendations for your telemetry pipeline.",
        }),
      };

      const { askRoomAiAction } = await import("./ai");
      const result = await askRoomAiAction("room-1", "Telemetry ideas", mockProvider);

      expect(result.success).toBe(true);
      expect(result.data?.cleanText).toContain("recommendations for your telemetry");
      expect(result.data?.isPlan).toBe(false);
      expect(result.data?.remainingQueries).toBe(14); // 20 - (5 + 1)
    });
  });

  describe("confirmAiPlanAction", () => {
    it("rejects confirming plan if member lacks can_edit_tasks permission", async () => {
      const memberChain = createMockChain({
        role: "member",
        status: "active",
        can_edit_tasks: false,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const { confirmAiPlanAction } = await import("./ai");
      const result = await confirmAiPlanAction("room-1", {
        type: "plan",
        title: "Test Plan",
        tasks: [{ title: "Task 1" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("permission to create or confirm task plans");
    });

    it("allows team lead or permitted member to confirm and materialize plan", async () => {
      const memberChain = createMockChain({
        role: "lead",
        status: "active",
        can_edit_tasks: true,
      });

      const taskInsertChain = createMockChain({ id: "root-task-1" });
      const subtaskInsertChain = createMockChain();
      subtaskInsertChain.select = vi.fn().mockResolvedValue({
        data: [{ id: "sub-1" }, { id: "sub-2" }],
        error: null,
      });

      let taskCalls = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return memberChain;
        if (table === "tasks") {
          taskCalls++;
          return taskCalls === 1 ? taskInsertChain : subtaskInsertChain;
        }
        return createMockChain();
      });

      const { confirmAiPlanAction } = await import("./ai");
      const result = await confirmAiPlanAction("room-1", {
        type: "plan",
        title: "AI Generated Sprint Plan",
        tasks: [
          {
            title: "Build Motor Controller",
            subtasks: [{ title: "Order MOSFETs" }, { title: "PCB Layout" }],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.createdTaskCount).toBe(3); // 1 root task + 2 subtasks
    });
  });
});
