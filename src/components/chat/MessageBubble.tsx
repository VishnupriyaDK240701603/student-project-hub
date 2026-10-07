"use client";

import React, { useState, useRef, useEffect } from "react";
import { REACTION_EMOJIS } from "@/lib/chat-validation";
import type { MessageWithSender, ReactionWithUser } from "@/server/actions/chat";
import type { Profile, RoomMember } from "@/types/database.types";

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
  showSenderHeader: boolean;
  currentUserId: string;
  members: (RoomMember & { profiles: Profile | null })[];
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReaction: (emoji: string) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  if (isToday) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;

  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

/**
 * Render message content with @mention highlighting.
 * Format in stored content: @[Display Name](userId)
 */
function renderContent(content: string, members: (RoomMember & { profiles: Profile | null })[]): React.ReactNode {
  if (!content) return null;

  const parts: React.ReactNode[] = [];
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const displayName = match[1];
    const userId = match[2];
    const member = members.find((m) => m.user_id === userId);

    parts.push(
      <span
        key={`mention-${match.index}`}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-accent/15 text-accent font-medium text-[0.85em] cursor-default"
        title={member?.profiles?.display_name || displayName}
      >
        @{displayName}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last mention
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

/** Group reactions by emoji with user lists */
function groupReactions(reactions: ReactionWithUser[]): { emoji: string; users: string[]; count: number }[] {
  const map = new Map<string, string[]>();
  for (const r of reactions) {
    const list = map.get(r.emoji) || [];
    list.push(r.profiles?.display_name || "User");
    map.set(r.emoji, list);
  }
  return Array.from(map.entries()).map(([emoji, users]) => ({
    emoji,
    users,
    count: users.length,
  }));
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showSenderHeader,
  currentUserId,
  members,
  onReply,
  onEdit,
  onDelete,
  onReaction,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
        setShowReactionPicker(false);
      }
    };
    if (showActions || showReactionPicker) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [showActions, showReactionPicker]);

  const displayName = message.profiles?.display_name || "Unknown";
  const groupedReactions = groupReactions(message.reactions || []);
  const hasReacted = (emoji: string) =>
    (message.reactions || []).some((r) => r.user_id === currentUserId && r.emoji === emoji);

  // Deleted message
  if (message.is_deleted) {
    return (
      <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""} py-0.5`}>
        <div
          className={`max-w-[75%] px-3 py-1.5 rounded-xl text-xs italic text-muted-foreground ${
            isOwn ? "bg-muted/30 rounded-tr-sm" : "bg-muted/20 rounded-tl-sm"
          }`}
        >
          <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : ""} ${showSenderHeader ? "pt-3" : "pt-0.5"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        if (!showReactionPicker) setShowActions(false);
      }}
    >
      {/* Avatar placeholder (only on sender header rows) */}
      {showSenderHeader ? (
        <div
          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
            isOwn
              ? "bg-accent/15 text-accent"
              : "bg-primary/10 text-primary"
          }`}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[75%] relative`}>
        {/* Sender name & time */}
        {showSenderHeader && (
          <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-semibold text-foreground">{displayName}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
          </div>
        )}

        {/* Reply reference */}
        {message.reply_to_id && (
          <div
            className={`text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1 ${
              isOwn ? "flex-row-reverse" : ""
            }`}
          >
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="italic truncate max-w-[200px]">reply</span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap transition-colors ${
            isOwn
              ? "bg-accent text-white rounded-tr-sm"
              : "bg-card border border-border text-foreground rounded-tl-sm"
          }`}
        >
          {renderContent(message.content, members)}

          {/* Edited indicator */}
          {message.is_edited && (
            <span className={`text-[10px] ml-1 ${isOwn ? "text-white/50" : "text-muted-foreground"}`}>
              (edited)
            </span>
          )}

          {/* Hovering action buttons */}
          {showActions && (
            <div
              ref={actionsRef}
              className={`absolute ${isOwn ? "left-0 -translate-x-full" : "right-0 translate-x-full"} top-0 flex items-center gap-0.5 px-1 z-10`}
            >
              {/* Reaction button */}
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="React"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Reply button */}
              <button
                onClick={onReply}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Reply"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>

              {/* Edit button (own messages only) */}
              {isOwn && !message.is_deleted && (
                <button
                  onClick={onEdit}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              {/* Delete button (own messages only) */}
              {isOwn && !message.is_deleted && (
                <button
                  onClick={onDelete}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              {/* Reaction picker popup */}
              {showReactionPicker && (
                <div
                  className={`absolute ${isOwn ? "right-0" : "left-0"} top-full mt-1 bg-card border border-border rounded-xl shadow-xl p-2 flex flex-wrap gap-1 w-52 z-20 animate-in fade-in-0 zoom-in-95`}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction(emoji);
                        setShowReactionPicker(false);
                      }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-accent/10 transition-colors ${
                        hasReacted(emoji) ? "bg-accent/15 ring-1 ring-accent/30" : ""
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reactions display */}
        {groupedReactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {groupedReactions.map(({ emoji, users, count }) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                  hasReacted(emoji)
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-card border-border text-muted-foreground hover:border-accent/30"
                }`}
                title={users.join(", ")}
              >
                <span>{emoji}</span>
                <span className="font-medium">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
