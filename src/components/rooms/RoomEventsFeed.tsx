"use client";

import React from "react";
import type { RoomEventWithActor } from "@/server/actions/room-management";

export interface RoomEventsFeedProps {
  events: RoomEventWithActor[];
  loading?: boolean;
}

export const RoomEventsFeed: React.FC<RoomEventsFeedProps> = ({ events, loading }) => {
  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading room activity feed...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground border rounded-lg p-6 bg-muted/20">
        No team events recorded yet.
      </div>
    );
  }

  const renderEventDetails = (event: RoomEventWithActor) => {
    const meta = (event.metadata || {}) as Record<string, unknown>;

    switch (event.event_type) {
      case "member_removed":
        return (
          <div className="mt-1 text-xs">
            <span className="font-semibold text-destructive">Member Removed.</span>
            <div className="mt-1 bg-destructive/10 text-destructive border border-destructive/20 rounded p-2 text-xs">
              <span className="font-semibold">Reason:</span> &ldquo;{String(meta.reason || "No reason specified")}&rdquo;
            </div>
          </div>
        );
      case "lead_swapped":
        return (
          <div className="mt-1 text-xs text-accent font-semibold">
            Leadership was transferred to a new team lead.
          </div>
        );
      case "member_left":
        return (
          <div className="mt-1 text-xs text-muted-foreground">
            A member left the project team.
          </div>
        );
      case "member_readded":
        return (
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
            A past member was re-added to the team.
          </div>
        );
      case "permissions_updated":
        return (
          <div className="mt-1 text-xs text-muted-foreground">
            Member permissions were updated by the lead.
          </div>
        );
      default:
        return (
          <div className="mt-1 text-xs text-muted-foreground">
            {event.event_type.replace(/_/g, " ")}
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
        Room Event Feed & Audit Log
      </h3>
      <div className="divide-y divide-border border rounded-lg bg-card overflow-hidden">
        {events.map((event) => (
          <div key={event.id} className="p-3 text-sm flex gap-3 items-start">
            <div className="mt-1 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium text-foreground text-xs">
                  {event.actor?.display_name || "System"} ({event.actor?.department || "Team"})
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {renderEventDetails(event)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
