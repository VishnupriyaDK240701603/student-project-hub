"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MessageRateLimiter, CHAT_LIMITS } from "@/lib/chat-validation";
import type { Profile, RoomMember } from "@/types/database.types";

interface MessageInputProps {
  roomId?: string;
  members: (RoomMember & { profiles: Profile | null })[];
  onSend: (content: string) => Promise<{ success: boolean; error?: string }>;
  editingContent?: string;
  placeholder?: string;
}

const rateLimiter = new MessageRateLimiter();

export const MessageInput: React.FC<MessageInputProps> = ({
  members,
  onSend,
  editingContent,
  placeholder = "Type a message...",
}) => {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When entering edit mode, populate the textarea
  useEffect(() => {
    if (editingContent !== undefined) {
      setContent(editingContent || "");
      textareaRef.current?.focus();
    }
  }, [editingContent]);

  // Filter members for mention autocomplete
  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return members;
    const q = mentionQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.profiles?.display_name?.toLowerCase().includes(q) ||
        m.profiles?.department?.toLowerCase().includes(q),
    );
  }, [mentionQuery, members]);

  // Reset mention selection index when suggestions change
  useEffect(() => {
    setMentionIndex(0);
  }, [filteredMembers.length]);

  // Detect @ trigger for mention autocomplete
  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      setError(null);

      // Check for @ trigger
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);

      // Find the last @ that isn't inside a completed mention
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");
      if (lastAtIndex >= 0) {
        const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

        // Only trigger if @ is at start or after whitespace, and no closing bracket
        if ((charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) && !textAfterAt.includes("]")) {
          setMentionQuery(textAfterAt);
          setShowMentions(true);
          return;
        }
      }

      setShowMentions(false);
    },
    [],
  );

  // Insert a mention into the text
  const insertMention = useCallback(
    (member: RoomMember & { profiles: Profile | null }) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = content.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex >= 0) {
        const before = content.slice(0, lastAtIndex);
        const after = content.slice(cursorPos);
        const displayName = member.profiles?.display_name || "User";
        const mentionStr = `@[${displayName}](${member.user_id}) `;

        const newContent = before + mentionStr + after;
        setContent(newContent);

        // Move cursor after the mention
        const newCursorPos = before.length + mentionStr.length;
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }

      setShowMentions(false);
      setMentionQuery("");
    },
    [content],
  );

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    if (!rateLimiter.canSend()) {
      setError("You're sending messages too quickly. Please wait a moment.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await onSend(trimmed);
      if (res.success) {
        setContent("");
      } else {
        setError(res.error || "Failed to send message.");
      }
    } catch {
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }, [content, sending, onSend]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Mention navigation
      if (showMentions && filteredMembers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(filteredMembers[mentionIndex]);
          return;
        }
        if (e.key === "Escape") {
          setShowMentions(false);
          return;
        }
      }

      // Send on Enter (not Shift+Enter)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [showMentions, filteredMembers, mentionIndex, insertMention, handleSend],
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [content]);

  const charCount = content.length;
  const isNearLimit = charCount > CHAT_LIMITS.maxMessageLength * 0.9;

  return (
    <div className="border-t border-border bg-card/50 px-3 py-2 relative">
      {/* Mention autocomplete popup */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-20 max-h-48 overflow-y-auto animate-in fade-in-0 slide-in-from-bottom-2">
          {filteredMembers.slice(0, 8).map((member, idx) => (
            <button
              key={member.user_id}
              onClick={() => insertMention(member)}
              className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors ${
                idx === mentionIndex
                  ? "bg-accent/10 text-accent"
                  : "hover:bg-muted/50 text-foreground"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                {(member.profiles?.display_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {member.profiles?.display_name || "User"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {member.profiles?.department || ""} · {member.role}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive mb-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-2 px-1 max-h-40 min-h-[36px]"
          disabled={sending}
          maxLength={CHAT_LIMITS.maxMessageLength + 100} // Allow slightly over for UX
        />

        <div className="flex items-center gap-1 shrink-0 pb-1">
          {/* Character count (near limit) */}
          {isNearLimit && (
            <span
              className={`text-[10px] font-mono ${
                charCount > CHAT_LIMITS.maxMessageLength ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {charCount}/{CHAT_LIMITS.maxMessageLength}
            </span>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
