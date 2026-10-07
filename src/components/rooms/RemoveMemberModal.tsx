"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@/components/ui";
import { MIN_REMOVAL_REASON_LENGTH } from "@/lib/room-management-validation";

export interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string;
  memberId: string;
  onConfirm: (reason: string) => Promise<void>;
}

export const RemoveMemberModal: React.FC<RemoveMemberModalProps> = ({
  isOpen,
  onClose,
  memberName,
  onConfirm,
}) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const isValidLength = trimmed.length >= MIN_REMOVAL_REASON_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLength) {
      setError(`A written reason of at least ${MIN_REMOVAL_REASON_LENGTH} characters is required.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Remove Member: ${memberName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Accountable Member Removal (Invariant 8)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A written reason is required and will be permanently recorded in the room event feed visible to all teammates. The member will lose access immediately.
          </p>
        </div>

        <div>
          <label htmlFor="removal-reason" className="block text-sm font-medium mb-1">
            Reason for Removal <span className="text-red-500">*</span>
          </label>
          <textarea
            id="removal-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain specifically why this member is being removed from the project team (minimum 10 characters)..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={submitting}
            required
          />
          <div className="flex justify-between items-center mt-1 text-xs">
            <span className={trimmed.length < MIN_REMOVAL_REASON_LENGTH ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
              {trimmed.length} / {MIN_REMOVAL_REASON_LENGTH} characters minimum
            </span>
            {trimmed.length < MIN_REMOVAL_REASON_LENGTH && (
              <span className="text-muted-foreground">
                {MIN_REMOVAL_REASON_LENGTH - trimmed.length} more required
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!isValidLength || submitting}
            isLoading={submitting}
          >
            Confirm Removal
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
