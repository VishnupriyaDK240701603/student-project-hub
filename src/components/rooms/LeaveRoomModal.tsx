"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@/components/ui";

export interface LeaveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLead: boolean;
  otherMembersCount: number;
  onConfirm: () => Promise<void>;
}

export const LeaveRoomModal: React.FC<LeaveRoomModalProps> = ({
  isOpen,
  onClose,
  isLead,
  otherMembersCount,
  onConfirm,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cannotLeaveAsLead = isLead && otherMembersCount > 0;

  const handleConfirm = async () => {
    if (cannotLeaveAsLead) {
      setError("As the team lead, you must transfer leadership to another member before leaving.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to leave room.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Leave Project Room">
      <div className="space-y-4">
        {cannotLeaveAsLead ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-sm text-amber-950 dark:text-amber-200">
            <p className="font-bold">Lead Handover Required</p>
            <p className="mt-1 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
              You are currently the team lead and other active members remain. Please transfer leadership in the Members tab before leaving.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-sm text-destructive">
            <p className="font-bold">Leave Room (&ldquo;Delete Room&rdquo;)</p>
            <p className="mt-1 text-xs text-destructive/90 dark:text-destructive leading-relaxed">
              Your access to this room, task board, and realtime discussions will end immediately. The team room will continue for other teammates. Your existing messages and files will remain attributed to you.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {!cannotLeaveAsLead && (
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirm}
              isLoading={submitting}
            >
              Confirm Leave Room
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
