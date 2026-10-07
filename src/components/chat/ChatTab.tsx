"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getMessagesAction,
  sendMessageAction,
  editMessageAction,
  deleteMessageAction,
  toggleReactionAction,
  type MessageWithSender,
} from "@/server/actions/chat";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Skeleton } from "@/components/ui";
import type { Profile, RoomMember } from "@/types/database.types";

interface ChatTabProps {
  roomId: string;
  currentUserId: string;
  members: (RoomMember & { profiles: Profile | null })[];
  isLead?: boolean;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  roomId,
  currentUserId,
  members,
}) => {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageWithSender | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Fetch initial messages
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await getMessagesAction(roomId);
      if (!cancelled && res.success && res.data) {
        setMessages(res.data.messages);
        setHasMore(res.data.hasMore);
      }
      setLoading(false);
      isInitialLoad.current = false;
    }

    load();
    return () => { cancelled = true; };
  }, [roomId]);

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom(isInitialLoad.current ? "instant" : "smooth");
    }
  }, [loading, messages.length, scrollToBottom]);

  // Subscribe to realtime messages
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Fetch full message with sender info
          const res = await getMessagesAction(roomId, undefined, 1);
          if (res.success && res.data && res.data.messages.length > 0) {
            const latestMsg = res.data.messages[res.data.messages.length - 1];
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.find((m) => m.id === latestMsg.id)) return prev;
              return [...prev, latestMsg];
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            content?: string;
            is_edited?: boolean;
            is_deleted?: boolean;
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    content: updated.content !== undefined ? updated.content : m.content,
                    is_edited: updated.is_edited !== undefined ? updated.is_edited : m.is_edited,
                    is_deleted: updated.is_deleted !== undefined ? updated.is_deleted : m.is_deleted,
                  }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
        },
        async () => {
          // Re-fetch latest messages to get updated reactions
          const res = await getMessagesAction(roomId);
          if (res.success && res.data) {
            setMessages(res.data.messages);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestMsg = messages[0];
    const res = await getMessagesAction(roomId, oldestMsg.created_at);
    if (res.success && res.data) {
      setMessages((prev) => [...res.data!.messages, ...prev]);
      setHasMore(res.data.hasMore);
    }
    setLoadingMore(false);
  }, [hasMore, loadingMore, messages, roomId]);

  // Handle sending a message
  const handleSend = useCallback(
    async (content: string) => {
      const res = await sendMessageAction(
        roomId,
        content,
        replyTo?.id || null,
      );
      if (res.success) {
        setReplyTo(null);
        // Optimistic: the realtime subscription will add the message
        // But also add it immediately for responsiveness
        if (res.data?.message) {
          const senderMember = activeMembers.find((m) => m.user_id === currentUserId);
          const optimisticMsg: MessageWithSender = {
            ...res.data.message,
            profiles: senderMember?.profiles
              ? { display_name: senderMember.profiles.display_name, department: senderMember.profiles.department }
              : null,
            reactions: [],
            mentions: [],
          };
          setMessages((prev) => {
            if (prev.find((m) => m.id === optimisticMsg.id)) return prev;
            return [...prev, optimisticMsg];
          });
        }
      }
      return res;
    },
    [roomId, replyTo, activeMembers, currentUserId],
  );

  // Handle editing a message
  const handleEdit = useCallback(
    async (content: string) => {
      if (!editingMessage) return { success: false, error: "No message to edit." };
      const res = await editMessageAction(editingMessage.id, content);
      if (res.success) {
        setEditingMessage(null);
        // Update in place
        if (res.data?.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === res.data!.message.id
                ? { ...m, content: res.data!.message.content, is_edited: true }
                : m,
            ),
          );
        }
      }
      return res;
    },
    [editingMessage],
  );

  // Handle deleting a message
  const handleDelete = useCallback(
    async (messageId: string) => {
      const res = await deleteMessageAction(messageId);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, content: "", is_deleted: true, reactions: [], mentions: [] } : m,
          ),
        );
      }
    },
    [],
  );

  // Handle toggling a reaction
  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReactionAction(messageId, emoji);
      // Realtime subscription will update reactions
    },
    [],
  );

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1 max-w-[70%]">
              <Skeleton className="h-3 w-20" />
              <Skeleton className={`h-12 rounded-xl ${i % 2 === 0 ? "rounded-tl-sm" : "rounded-tr-sm"}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] border rounded-xl bg-card/30 overflow-hidden">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {/* Load more button */}
        {hasMore && (
          <div className="text-center pb-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "↑ Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">No messages yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Be the first to say something! Use @mentions to tag teammates.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const isOwn = msg.sender_id === currentUserId;
          const showSenderHeader =
            !prevMsg ||
            prevMsg.sender_id !== msg.sender_id ||
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              showSenderHeader={showSenderHeader}
              currentUserId={currentUserId}
              members={activeMembers}
              onReply={() => setReplyTo(msg)}
              onEdit={() => setEditingMessage(msg)}
              onDelete={() => handleDelete(msg.id)}
              onReaction={(emoji) => handleReaction(msg.id, emoji)}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply / Edit banner */}
      {(replyTo || editingMessage) && (
        <div className="px-4 py-2 bg-accent/5 border-t border-accent/20 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-accent">
              {editingMessage ? "Editing message" : `Replying to ${replyTo?.profiles?.display_name || "message"}`}
            </span>
            <p className="text-xs text-muted-foreground truncate">
              {editingMessage?.content || replyTo?.content}
            </p>
          </div>
          <button
            onClick={() => {
              setReplyTo(null);
              setEditingMessage(null);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Cancel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Message input */}
      <MessageInput
        roomId={roomId}
        members={activeMembers}
        onSend={editingMessage ? handleEdit : handleSend}
        editingContent={editingMessage?.content}
        placeholder={
          editingMessage
            ? "Edit your message..."
            : replyTo
              ? `Reply to ${replyTo.profiles?.display_name || "message"}...`
              : "Type a message... Use @ to mention teammates"
        }
      />
    </div>
  );
};
