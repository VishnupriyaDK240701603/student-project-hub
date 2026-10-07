import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockStorage = {
  from: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-url" },
      error: null,
    }),
  })),
};

const mockUser = { id: "user-lead-1" };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: mockFrom,
      rpc: mockRpc,
      storage: mockStorage,
    }),
  ),
}));

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: undefined;
}

// Track inserts/selects for different tables
function createMockChain(data: unknown = null, error: unknown = null): MockChain {
  const chain: Partial<MockChain> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  chain.then = undefined; // Prevent Promise-like behavior
  return chain as MockChain;
}

describe("Chat Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMessageAction", () => {
    it("requires room membership to send messages", async () => {
      // Mock room_members query returning no membership
      const noMemberChain = createMockChain(null);

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") return noMemberChain;
        return createMockChain();
      });

      const { sendMessageAction } = await import("@/server/actions/chat");
      const result = await sendMessageAction("room-1", "Hello!");

      expect(result.success).toBe(false);
      expect(result.error).toContain("active room members");
    });

    it("validates message content", async () => {
      // Mock active membership
      const memberChain = createMockChain({ role: "member" });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "room_members") {
          callCount++;
          if (callCount === 1) return memberChain; // Membership check
          // Members list for mention validation
          const listChain = createMockChain();
          // Override to return array-like result
          listChain.eq = vi.fn().mockReturnValue({
            ...listChain,
            eq: vi.fn().mockResolvedValue({ data: [{ user_id: "user-1" }], error: null }),
          });
          return listChain;
        }
        return createMockChain();
      });

      const { sendMessageAction } = await import("@/server/actions/chat");
      const result = await sendMessageAction("room-1", "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });
  });

  describe("editMessageAction", () => {
    it("prevents editing other users' messages", async () => {
      // Mock message belonging to another user
      const msgChain = createMockChain({
        id: "msg-1",
        sender_id: "user-other",
        room_id: "room-1",
        is_deleted: false,
        content: "Original",
      });

      mockFrom.mockImplementation(() => msgChain);

      const { editMessageAction } = await import("@/server/actions/chat");
      const result = await editMessageAction("msg-1", "Hacked!");

      expect(result.success).toBe(false);
      expect(result.error).toContain("own messages");
    });

    it("prevents editing deleted messages", async () => {
      const msgChain = createMockChain({
        id: "msg-1",
        sender_id: "user-lead-1",
        room_id: "room-1",
        is_deleted: true,
        content: "",
      });

      mockFrom.mockImplementation(() => msgChain);

      const { editMessageAction } = await import("@/server/actions/chat");
      const result = await editMessageAction("msg-1", "Try editing deleted");

      expect(result.success).toBe(false);
      expect(result.error).toContain("deleted");
    });
  });

  describe("deleteMessageAction", () => {
    it("prevents deleting other users' messages", async () => {
      const msgChain = createMockChain({
        id: "msg-1",
        sender_id: "user-other",
        content: "Not yours",
      });

      mockFrom.mockImplementation(() => msgChain);

      const { deleteMessageAction } = await import("@/server/actions/chat");
      const result = await deleteMessageAction("msg-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("own messages");
    });
  });

  describe("toggleReactionAction", () => {
    it("rejects invalid emoji", async () => {
      const { toggleReactionAction } = await import("@/server/actions/chat");
      const result = await toggleReactionAction("msg-1", "");

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  describe("deleteRoomFileAction", () => {
    it("prevents non-uploader/non-lead from deleting", async () => {
      // File uploaded by someone else
      const fileChain = createMockChain({
        id: "file-1",
        uploaded_by: "user-other",
        room_id: "room-1",
        storage_path: "rooms/room-1/file.pdf",
        file_name: "file.pdf",
      });

      // Membership: member, not lead
      const memberChain = createMockChain({ role: "member" });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_files") return fileChain;
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const { deleteRoomFileAction } = await import("@/server/actions/chat");
      const result = await deleteRoomFileAction("file-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("uploader or team lead");
    });
  });

  describe("getFileDownloadUrlAction", () => {
    it("returns signed URL for valid file", async () => {
      const fileChain = createMockChain({
        id: "file-1",
        room_id: "room-1",
        storage_path: "rooms/room-1/test.pdf",
      });

      const memberChain = createMockChain({ role: "member" });

      mockFrom.mockImplementation((table: string) => {
        if (table === "room_files") return fileChain;
        if (table === "room_members") return memberChain;
        return createMockChain();
      });

      const { getFileDownloadUrlAction } = await import("@/server/actions/chat");
      const result = await getFileDownloadUrlAction("file-1");

      expect(result.success).toBe(true);
      expect(result.data?.url).toContain("signed-url");
    });
  });
});
