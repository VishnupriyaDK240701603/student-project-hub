import { describe, it, expect, beforeEach } from "vitest";
import {
  validateChatMessage,
  validateReaction,
  MessageRateLimiter,
  renderMentionDisplay,
  generateRoomFileStoragePath,
  CHAT_LIMITS,
  REACTION_EMOJIS,
} from "@/lib/chat-validation";

describe("Chat Validation", () => {
  const memberIds = ["user-1", "user-2", "user-3"];

  describe("validateChatMessage", () => {
    it("rejects empty messages", () => {
      expect(validateChatMessage("", memberIds).valid).toBe(false);
      expect(validateChatMessage("   ", memberIds).valid).toBe(false);
    });

    it("accepts a valid message", () => {
      const result = validateChatMessage("Hello team! Let's get started.", memberIds);
      expect(result.valid).toBe(true);
      expect(result.sanitizedContent).toBe("Hello team! Let's get started.");
    });

    it("rejects messages exceeding max length", () => {
      const longMessage = "a".repeat(CHAT_LIMITS.maxMessageLength + 1);
      const result = validateChatMessage(longMessage, memberIds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("character limit");
    });

    it("accepts messages at exactly max length", () => {
      const exactMessage = "a".repeat(CHAT_LIMITS.maxMessageLength);
      const result = validateChatMessage(exactMessage, memberIds);
      expect(result.valid).toBe(true);
    });

    it("sanitizes script tags", () => {
      const result = validateChatMessage('Hello <script>alert("xss")</script> world', memberIds);
      expect(result.valid).toBe(true);
      expect(result.sanitizedContent).not.toContain("<script");
    });

    it("sanitizes iframe tags", () => {
      const result = validateChatMessage('Check <iframe src="evil.com"></iframe> this', memberIds);
      expect(result.valid).toBe(true);
      expect(result.sanitizedContent).not.toContain("<iframe");
    });

    it("sanitizes event handlers", () => {
      const result = validateChatMessage('Hello <div onclick="alert(1)">world</div>', memberIds);
      expect(result.valid).toBe(true);
      expect(result.sanitizedContent).not.toContain("onclick");
    });

    it("sanitizes javascript: protocol", () => {
      const result = validateChatMessage('Click javascript:alert(1) here', memberIds);
      expect(result.valid).toBe(true);
      expect(result.sanitizedContent).not.toContain("javascript:");
    });

    it("extracts valid @mentions", () => {
      const content = "Hey @[Alice](user-1) and @[Bob](user-2), check this out!";
      const result = validateChatMessage(content, memberIds);
      expect(result.valid).toBe(true);
      expect(result.extractedMentions).toEqual(["user-1", "user-2"]);
    });

    it("ignores mentions of non-member user IDs", () => {
      const content = "Hey @[Stranger](user-999), you shouldn't be here!";
      const result = validateChatMessage(content, memberIds);
      expect(result.valid).toBe(true);
      expect(result.extractedMentions).toEqual([]);
    });

    it("deduplicates multiple mentions of the same user", () => {
      const content = "Hey @[Alice](user-1) and @[Alice](user-1) again!";
      const result = validateChatMessage(content, memberIds);
      expect(result.valid).toBe(true);
      expect(result.extractedMentions).toEqual(["user-1"]);
    });

    it("rejects messages with too many mentions", () => {
      const mentions = Array.from({ length: CHAT_LIMITS.maxMentionsPerMessage + 1 }, (_, i) => `user-${i}`);
      const allMemberIds = [...memberIds, ...mentions];
      const content = mentions.map((id) => `@[User${id}](${id})`).join(" ");
      const result = validateChatMessage(content, allMemberIds);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Too many mentions");
    });

    it("trims whitespace from messages", () => {
      const result = validateChatMessage("  Hello world  ", memberIds);
      expect(result.valid).toBe(true);
      expect(result.sanitizedContent).toBe("Hello world");
    });
  });

  describe("validateReaction", () => {
    it("rejects empty emoji", () => {
      expect(validateReaction("").valid).toBe(false);
    });

    it("accepts valid emoji", () => {
      expect(validateReaction("👍").valid).toBe(true);
      expect(validateReaction("❤️").valid).toBe(true);
      expect(validateReaction("🚀").valid).toBe(true);
    });

    it("rejects overly long emoji strings", () => {
      expect(validateReaction("a".repeat(11)).valid).toBe(false);
    });

    it("accepts all curated reaction emojis", () => {
      for (const emoji of REACTION_EMOJIS) {
        expect(validateReaction(emoji).valid).toBe(true);
      }
    });
  });

  describe("MessageRateLimiter", () => {
    let limiter: MessageRateLimiter;

    beforeEach(() => {
      limiter = new MessageRateLimiter(5); // 5 per minute for testing
    });

    it("allows messages within rate limit", () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.canSend()).toBe(true);
      }
    });

    it("blocks messages exceeding rate limit", () => {
      for (let i = 0; i < 5; i++) {
        limiter.canSend();
      }
      expect(limiter.canSend()).toBe(false);
    });

    it("reports correct remaining count", () => {
      expect(limiter.remaining).toBe(5);
      limiter.canSend();
      expect(limiter.remaining).toBe(4);
    });
  });

  describe("renderMentionDisplay", () => {
    it("replaces mention syntax with display name", () => {
      const content = "Hey @[Alice](user-1), check this out!";
      expect(renderMentionDisplay(content)).toBe("Hey @Alice, check this out!");
    });

    it("handles multiple mentions", () => {
      const content = "@[Alice](user-1) and @[Bob](user-2) are here.";
      expect(renderMentionDisplay(content)).toBe("@Alice and @Bob are here.");
    });

    it("returns unchanged text without mentions", () => {
      const content = "No mentions here.";
      expect(renderMentionDisplay(content)).toBe("No mentions here.");
    });
  });

  describe("generateRoomFileStoragePath", () => {
    it("generates a path in the correct format", () => {
      const path = generateRoomFileStoragePath("room-123", "document.pdf");
      expect(path).toMatch(/^rooms\/room-123\/[a-f0-9-]+\.pdf$/);
    });

    it("lowercases the extension", () => {
      const path = generateRoomFileStoragePath("room-123", "Photo.PNG");
      expect(path).toMatch(/\.png$/);
    });

    it("defaults to bin for no extension", () => {
      const path = generateRoomFileStoragePath("room-123", "noextension");
      expect(path).toMatch(/\.noextension$/);
    });

    it("generates unique paths for the same file", () => {
      const path1 = generateRoomFileStoragePath("room-1", "file.pdf");
      const path2 = generateRoomFileStoragePath("room-1", "file.pdf");
      expect(path1).not.toBe(path2);
    });
  });
});
