"use client";

import React, { useState } from "react";
import { Button, Input, Badge } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import {
  createMeetingAction,
  deleteMeetingAction,
  type MeetingWithCreator,
} from "@/server/actions/tasks";

interface MeetingsSectionProps {
  roomId: string;
  meetings: MeetingWithCreator[];
  currentUserId: string;
  isLead: boolean;
  onRefresh: () => Promise<void>;
}

export const MeetingsSection: React.FC<MeetingsSectionProps> = ({
  roomId,
  meetings,
  currentUserId,
  isLead,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !meetingLink.trim() || !scheduledAt) {
      setError("Title, meeting link, and date/time are required.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await createMeetingAction(roomId, {
      title: title.trim(),
      meeting_link: meetingLink.trim(),
      scheduled_at: new Date(scheduledAt).toISOString(),
    });

    if (res.success) {
      setTitle("");
      setMeetingLink("");
      setScheduledAt("");
      setIsModalOpen(false);
      await onRefresh();
    } else {
      setError(res.error || "Failed to schedule meeting.");
    }
    setSaving(false);
  };

  const handleDelete = async (meetingId: string) => {
    if (!confirm("Are you sure you want to remove this meeting?")) return;
    await deleteMeetingAction(meetingId);
    await onRefresh();
  };

  return (
    <div className="bg-card/40 border border-border/80 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-foreground">Team Meetings</h3>
          <Badge variant="neutral" className="text-xs">
            {meetings.length}
          </Badge>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsModalOpen(true)}
          className="text-xs h-7"
        >
          + Schedule Meeting
        </Button>
      </div>

      {meetings.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No meetings scheduled yet. Any team member can add a meeting link.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {meetings.map((m) => {
            const date = new Date(m.scheduled_at);
            const isPast = date.getTime() < Date.now();
            const formattedDate = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const canDelete = isLead || m.created_by === currentUserId;

            return (
              <div
                key={m.id}
                className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2 transition-colors ${
                  isPast ? "bg-muted/20 border-border/40 opacity-70" : "bg-card border-border hover:border-accent/40"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold text-foreground truncate">{m.title}</p>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5 transition-colors"
                        aria-label={`Delete meeting ${m.title}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formattedDate} {isPast && "(Past)"}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground truncate">
                    by {m.profiles?.display_name || "Member"}
                  </span>
                  <a
                    href={m.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    Join Call ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Meeting Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Meeting"
        className="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Meeting Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Standup / Mentor Review"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Video Call Link (Google Meet, Zoom, Teams) *
            </label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              type="url"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-accent focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !title.trim() || !meetingLink.trim() || !scheduledAt}
            >
              {saving ? "Scheduling..." : "Schedule Meeting"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
