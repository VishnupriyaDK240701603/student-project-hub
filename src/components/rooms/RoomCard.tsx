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
    <div className="glass-card rounded-2xl p-5 flex flex-col justify-between text-left h-full group relative overflow-hidden transition-all duration-300">
      {/* Decorative gradient radial blur on hover */}
      <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-pink-500/5 blur-2xl group-hover:scale-125 transition-all duration-500 pointer-events-none" />

      <div className="space-y-3">
        {/* Header Badge */}
        <div className="flex items-start justify-between gap-2">
          <Badge variant={isLead ? "accent" : "neutral"} size="sm" dot={isLead}>
            {isLead ? "Team Lead" : "Team Member"}
          </Badge>

          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            ● Active Room
          </span>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-base text-foreground group-hover:text-accent transition-colors line-clamp-1 leading-snug">
          <Link href={`/rooms/${room.id}`} className="hover:underline">
            {title}
          </Link>
        </h3>

        {/* Description */}
        {request?.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-normal">
            {request.description}
          </p>
        )}

        {/* Skill Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-accent/10 text-accent border border-accent/20"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 mt-4 border-t border-border flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          Formed {new Date(room.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
        </span>
        <Link href={`/rooms/${room.id}`}>
          <Button size="sm" variant="primary" className="font-bold rounded-xl text-xs px-4 py-1.5 shadow-md">
            Enter Workspace &rarr;
          </Button>
        </Link>
      </div>
    </div>
  );
};

