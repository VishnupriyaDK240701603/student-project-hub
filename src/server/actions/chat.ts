"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  validateChatMessage,
  validateReaction,
  generateRoomFileStoragePath,
  CHAT_LIMITS,
} from "@/lib/chat-validation";
import { validateUploadFile } from "@/lib/storage/upload-validation";
import type { ActionResult } from "./rooms";
import type { Message, Reaction, RoomFile, Profile } from "@/types/database.types";

// ---------- Composite Types ----------

export interface MessageWithSender extends Message {
  profiles: Pick<Profile, "display_name" | "department"> | null;
  reactions: ReactionWithUser[];
  mentions: { mentioned_user_id: string }[];
  reply_to?: MessageWithSender | null;
}

export interface ReactionWithUser extends Reaction {
  profiles?: Pick<Profile, "display_name"> | null;
}

export interface RoomFileWithUploader extends RoomFile {
  profiles: Pick<Profile, "display_name"> | null;
}

// ---------- Helpers ----------

async function verifyRoomMembership(
  supabase: ReturnType<Awaited<ReturnType<typeof createServerSupabaseClient>> extends infer T ? () => T : never> extends () => infer R ? R : never,
  userId: string,
  roomId: string,
): Promise<{ isMember: boolean; isLead: boolean; role: string | null }> {
  const { data } = await (supabase as Awaited<ReturnType<typeof createServerSupabaseClient>>)
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return {
    isMember: !!data,
    isLead: data?.role === "lead",
    role: data?.role || null,
  };
}

// ---------- Messages ----------

/**
 * Send a new message in a room chat.
 * All room members (including mentors) can chat (F7 spec).
 */
export async function sendMessageAction(
  roomId: string,
  content: string,
  replyToId?: string | null,
  attachmentIds?: string[],
): Promise<ActionResult<{ message: Message }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Verify membership
  const membership = await verifyRoomMembership(supabase as never, user.id, roomId);
  if (!membership.isMember) {
    return { success: false, error: "Only active room members can send messages." };
  }

  // Fetch member IDs for mention validation
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("status", "active");

  const memberIds = (members || []).map((m) => m.user_id);

  // Validate message content
  const validation = validateChatMessage(content, memberIds);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Validate reply_to exists in the same room
  if (replyToId) {
    const { data: replyMsg } = await supabase
      .from("messages")
      .select("id, room_id")
      .eq("id", replyToId)
      .eq("room_id", roomId)
      .maybeSingle();

    if (!replyMsg) {
      return { success: false, error: "Reply target message not found in this room." };
    }
  }

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: user.id,
      content: validation.sanitizedContent!,
      reply_to_id: replyToId || null,
      is_edited: false,
      is_deleted: false,
    })
    .select()
    .single();

  if (insertError || !message) {
    return { success: false, error: insertError?.message || "Failed to send message." };
  }

  // Insert mentions
  if (validation.extractedMentions && validation.extractedMentions.length > 0) {
    const mentionRows = validation.extractedMentions.map((userId) => ({
      message_id: message.id,
      mentioned_user_id: userId,
    }));

    await supabase.from("mentions").insert(mentionRows);
  }

  // Link attachments to message (update room_files with message reference if needed)
  if (attachmentIds && attachmentIds.length > 0) {
    // Attachments are uploaded separately and linked by the client
    // No additional server action needed here for v1
  }

  return { success: true, data: { message: message as Message } };
}

/**
 * Edit own message. Only the sender can edit, and message is marked as edited.
 */
export async function editMessageAction(
  messageId: string,
  newContent: string,
): Promise<ActionResult<{ message: Message }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Fetch existing message
  const { data: existing, error: fetchError } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Message not found." };
  }

  if (existing.sender_id !== user.id) {
    return { success: false, error: "You can only edit your own messages." };
  }

  if (existing.is_deleted) {
    return { success: false, error: "Cannot edit a deleted message." };
  }

  // Fetch member IDs for mention validation
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", existing.room_id)
    .eq("status", "active");

  const memberIds = (members || []).map((m) => m.user_id);
  const validation = validateChatMessage(newContent, memberIds);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Update message
  const { data: updated, error: updateError } = await supabase
    .from("messages")
    .update({
      content: validation.sanitizedContent!,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single();

  if (updateError || !updated) {
    return { success: false, error: updateError?.message || "Failed to edit message." };
  }

  // Re-insert mentions (delete old, add new)
  await supabase.from("mentions").delete().eq("message_id", messageId);
  if (validation.extractedMentions && validation.extractedMentions.length > 0) {
    const mentionRows = validation.extractedMentions.map((userId) => ({
      message_id: messageId,
      mentioned_user_id: userId,
    }));
    await supabase.from("mentions").insert(mentionRows);
  }

  return { success: true, data: { message: updated as Message } };
}

/**
 * Delete own message (soft delete). Content is cleared but metadata stays.
 */
export async function deleteMessageAction(
  messageId: string,
): Promise<ActionResult<null>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: existing } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (!existing) {
    return { success: false, error: "Message not found." };
  }

  if (existing.sender_id !== user.id) {
    return { success: false, error: "You can only delete your own messages." };
  }

  const { error: updateError } = await supabase
    .from("messages")
    .update({
      content: "",
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Clean up reactions and mentions for deleted messages
  await supabase.from("reactions").delete().eq("message_id", messageId);
  await supabase.from("mentions").delete().eq("message_id", messageId);

  return { success: true };
}

/**
 * Fetch paginated messages for a room.
 */
export async function getMessagesAction(
  roomId: string,
  cursor?: string, // ISO timestamp for pagination
  limit: number = 50,
): Promise<ActionResult<{ messages: MessageWithSender[]; hasMore: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify membership
  const membership = await verifyRoomMembership(supabase as never, user.id, roomId);
  if (!membership.isMember) {
    return { success: false, error: "Access denied." };
  }

  let query = supabase
    .from("messages")
    .select(
      "*, profiles:sender_id(display_name, department), reactions(*, profiles:user_id(display_name)), mentions(mentioned_user_id)",
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  const messages = (data || []) as unknown as MessageWithSender[];
  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }

  // Reverse for chronological order
  messages.reverse();

  return { success: true, data: { messages, hasMore } };
}

// ---------- Reactions ----------

/**
 * Toggle a reaction on a message (add if not exists, remove if exists).
 */
export async function toggleReactionAction(
  messageId: string,
  emoji: string,
): Promise<ActionResult<{ added: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const reactionValidation = validateReaction(emoji);
  if (!reactionValidation.valid) {
    return { success: false, error: reactionValidation.error };
  }

  // Verify message exists and user has room access
  const { data: message } = await supabase
    .from("messages")
    .select("room_id")
    .eq("id", messageId)
    .single();

  if (!message) {
    return { success: false, error: "Message not found." };
  }

  const membership = await verifyRoomMembership(supabase as never, user.id, message.room_id);
  if (!membership.isMember) {
    return { success: false, error: "Access denied." };
  }

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    // Remove reaction
    await supabase.from("reactions").delete().eq("id", existing.id);
    return { success: true, data: { added: false } };
  }

  // Check limit
  const { count } = await supabase
    .from("reactions")
    .select("id", { count: "exact", head: true })
    .eq("message_id", messageId)
    .eq("user_id", user.id);

  if ((count || 0) >= CHAT_LIMITS.maxReactionsPerMessagePerUser) {
    return {
      success: false,
      error: `You can add at most ${CHAT_LIMITS.maxReactionsPerMessagePerUser} reactions per message.`,
    };
  }

  // Add reaction
  const { error: insertError } = await supabase.from("reactions").insert({
    message_id: messageId,
    user_id: user.id,
    emoji,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true, data: { added: true } };
}

// ---------- Room Files ----------

/**
 * Upload a file to the room. All members can upload (F7 spec).
 */
export async function uploadRoomFileAction(
  roomId: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number,
  fileBase64: string,
): Promise<ActionResult<{ file: RoomFile }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify membership
  const membership = await verifyRoomMembership(supabase as never, user.id, roomId);
  if (!membership.isMember) {
    return { success: false, error: "Only active room members can upload files." };
  }

  // Validate the file
  const fileBytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  const validation = validateUploadFile(fileName, fileType, fileSizeBytes, fileBytes.slice(0, 512));
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const storagePath = generateRoomFileStoragePath(roomId, validation.sanitizedFilename || fileName);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("room-files")
    .upload(storagePath, fileBytes, {
      contentType: fileType,
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  // Insert record
  const { data: fileRecord, error: insertError } = await supabase
    .from("room_files")
    .insert({
      room_id: roomId,
      uploaded_by: user.id,
      storage_path: storagePath,
      file_name: validation.sanitizedFilename || fileName,
      file_type: fileType,
      file_size_bytes: fileSizeBytes,
    })
    .select()
    .single();

  if (insertError || !fileRecord) {
    return { success: false, error: insertError?.message || "Failed to record file." };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room_file.uploaded",
    target: fileRecord.id,
    metadata: {
      room_id: roomId,
      file_name: validation.sanitizedFilename,
      file_size: fileSizeBytes,
    },
  });

  return { success: true, data: { file: fileRecord as RoomFile } };
}

/**
 * Delete a room file. Only the uploader or lead can delete (F8 spec).
 */
export async function deleteRoomFileAction(
  fileId: string,
): Promise<ActionResult<null>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: fileRecord, error: fetchError } = await supabase
    .from("room_files")
    .select("*")
    .eq("id", fileId)
    .single();

  if (fetchError || !fileRecord) {
    return { success: false, error: "File not found." };
  }

  const membership = await verifyRoomMembership(supabase as never, user.id, fileRecord.room_id);
  if (!membership.isMember) {
    return { success: false, error: "Access denied." };
  }

  // Only uploader or lead can delete
  if (fileRecord.uploaded_by !== user.id && !membership.isLead) {
    return { success: false, error: "Only the uploader or team lead can delete this file." };
  }

  // Delete from storage
  await supabase.storage.from("room-files").remove([fileRecord.storage_path]);

  // Delete record
  const { error: deleteError } = await supabase
    .from("room_files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "room_file.deleted",
    target: fileId,
    metadata: {
      room_id: fileRecord.room_id,
      file_name: fileRecord.file_name,
      deleted_by: user.id,
    },
  });

  return { success: true };
}

/**
 * Get all files in a room.
 */
export async function getRoomFilesAction(
  roomId: string,
): Promise<ActionResult<RoomFileWithUploader[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const membership = await verifyRoomMembership(supabase as never, user.id, roomId);
  if (!membership.isMember) {
    return { success: false, error: "Access denied." };
  }

  const { data, error } = await supabase
    .from("room_files")
    .select("*, profiles:uploaded_by(display_name)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as RoomFileWithUploader[] };
}

/**
 * Get a signed download URL for a room file.
 */
export async function getFileDownloadUrlAction(
  fileId: string,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: fileRecord } = await supabase
    .from("room_files")
    .select("*")
    .eq("id", fileId)
    .single();

  if (!fileRecord) {
    return { success: false, error: "File not found." };
  }

  const membership = await verifyRoomMembership(supabase as never, user.id, fileRecord.room_id);
  if (!membership.isMember) {
    return { success: false, error: "Access denied." };
  }

  const { data: signedUrl, error: signError } = await supabase.storage
    .from("room-files")
    .createSignedUrl(fileRecord.storage_path, 3600); // 1 hour expiry

  if (signError || !signedUrl) {
    return { success: false, error: "Failed to generate download URL." };
  }

  return { success: true, data: { url: signedUrl.signedUrl } };
}
