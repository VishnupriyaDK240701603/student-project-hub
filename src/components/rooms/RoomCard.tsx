"use client";

import React from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import type { Room, TeamRequest } from "@/types/database.types";

export interface RoomCardProps {
  room: Room & { team_requests: TeamRequest | null };
  currentUserId: string;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, currentUserId }) => {
  const request = room.team_requests;
  const isLead = room.lead_id === currentUserId;
  const title = request?.title || "Project Team Room";
  const tags = request?.tags || [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base text-foreground line-clamp-1">
            {title}
          </h3>
          <Badge variant={isLead ? "accent" : "neutral"} size="sm">
            {isLead ? "Lead" : "Member"}
          </Badge>
        </div>

        {request?.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {request.description}
          </p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Formed {new Date(room.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
        </span>
        <Link href={`/rooms/${room.id}`}>
          <Button size="sm" variant="primary">
            Open Room &rarr;
          </Button>
        </Link>
      </div>
    </div>
  );
};
