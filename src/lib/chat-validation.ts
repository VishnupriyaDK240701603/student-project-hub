import { APP_LIMITS } from "@/config/limits";

export const CHAT_LIMITS = {
  maxMessageLength: 4000,
  maxReplyDepth: 1, // replies are flat (reply to a message, not to a reply's reply)
  maxReactionsPerMessagePerUser: 5,
  maxMentionsPerMessage: 10,
  maxAttachmentsPerMessage: 5,
} as const;

/** Common emoji set for reactions */
export const REACTION_EMOJIS = [
  "👍", "👎", "❤️", "🎉", "🚀", "👀", "💯", "🔥", "😂", "😮",
  "🙏", "✅", "❌", "⚡", "💡",
] as const;

export interface ChatMessageValidation {
  valid: boolean;
  error?: string;
  sanitizedContent?: string;
  extractedMentions?: string[]; // user IDs
}

/**
 * Validate and sanitize a chat message before sending.
 */
export function validateChatMessage(
  content: string,
  memberIds: string[],
): ChatMessageValidation {
  if (!content || !content.trim()) {
    return { valid: false, error: "Message cannot be empty." };
  }

  const trimmed = content.trim();

  if (trimmed.length > CHAT_LIMITS.maxMessageLength) {
    return {
      valid: false,
      error: `Message exceeds ${CHAT_LIMITS.maxMessageLength} character limit (${trimmed.length} characters).`,
    };
  }

  // Sanitize: remove script/iframe/embed tags, dangerous attributes
  const sanitized = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:[^"']*/gi, "");

  // Extract @mentions — format: @[display_name](userId)
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const extractedMentions: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(sanitized)) !== null) {
    const userId = match[2];
    if (memberIds.includes(userId) && !extractedMentions.includes(userId)) {
      extractedMentions.push(userId);
    }
  }

  if (extractedMentions.length > CHAT_LIMITS.maxMentionsPerMessage) {
    return {
      valid: false,
      error: `Too many mentions. Maximum ${CHAT_LIMITS.maxMentionsPerMessage} per message.`,
    };
  }

  return {
    valid: true,
    sanitizedContent: sanitized,
    extractedMentions,
  };
}

/**
 * Validate an emoji reaction.
 */
export function validateReaction(emoji: string): { valid: boolean; error?: string } {
  if (!emoji) {
    return { valid: false, error: "Emoji is required." };
  }

  // Allow any single emoji or check against our curated set
  if (emoji.length > 10) {
    return { valid: false, error: "Invalid emoji." };
  }

  return { valid: true };
}

/**
 * Simple rate limiter helper (in-memory, per client session).
 * Returns true if the action should be allowed.
 */
export class MessageRateLimiter {
  private timestamps: number[] = [];
  private maxPerMinute: number;

  constructor(maxPerMinute: number = APP_LIMITS.maxMessagesPerMinute) {
    this.maxPerMinute = maxPerMinute;
  }

  canSend(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Prune old timestamps
    this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);

    if (this.timestamps.length >= this.maxPerMinute) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  get remaining(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const recent = this.timestamps.filter((ts) => ts > oneMinuteAgo).length;
    return Math.max(0, this.maxPerMinute - recent);
  }
}

/**
 * Format a mention for display: @[display_name](userId) → @display_name
 */
export function renderMentionDisplay(content: string): string {
  return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

/**
 * Generate storage path for room files.
 * Format: rooms/{roomId}/{uuid}.{ext}
 */
export function generateRoomFileStoragePath(
  roomId: string,
  filename: string,
): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `rooms/${roomId}/${uniqueId}.${ext}`;
}
