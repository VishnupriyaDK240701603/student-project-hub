"use client";

import React, { useState } from "react";
import { RoomShell, type RoomTab } from "@/components/rooms/RoomShell";
import { getRoomDetailsAction, type RoomWithDetails } from "@/server/actions/rooms";
import {
  getPendingLeadSwapAction,
  getRoomEventsAction,
  type RoomEventWithActor,
} from "@/server/actions/room-management";
import type { LeadTransfer } from "@/types/database.types";

export interface RoomDetailClientProps {
  initialRoom: RoomWithDetails;
  initialEvents: RoomEventWithActor[];
  initialTransfer: LeadTransfer | null;
  currentUserId: string;
  initialTab?: RoomTab;
}

export const RoomDetailClient: React.FC<RoomDetailClientProps> = ({
  initialRoom,
  initialEvents,
  initialTransfer,
  currentUserId,
  initialTab,
}) => {
  const [room, setRoom] = useState<RoomWithDetails>(initialRoom);
  const [events, setEvents] = useState<RoomEventWithActor[]>(initialEvents);
  const [transfer, setTransfer] = useState<LeadTransfer | null>(initialTransfer);

  const handleRefresh = async () => {
    try {
      const [roomRes, eventsRes, transferRes] = await Promise.all([
        getRoomDetailsAction(room.id),
        getRoomEventsAction(room.id),
        getPendingLeadSwapAction(room.id),
      ]);

      if (roomRes.success && roomRes.data) {
        setRoom(roomRes.data);
      }
      if (eventsRes.success && eventsRes.data) {
        setEvents(eventsRes.data);
      }
      if (transferRes.success) {
        setTransfer(transferRes.data || null);
      }
    } catch (e) {
      console.error("Failed to refresh room state:", e);
    }
  };

  return (
    <RoomShell
      room={room}
      currentUserId={currentUserId}
      initialTab={initialTab}
      pendingTransfer={transfer}
      events={events}
      onRefresh={handleRefresh}
    />
  );
};
