"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@/components/ui";

export interface LeadSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  flow: "offer" | "request";
  targetMemberName?: string;
  onConfirm: () => Promise<void>;
}

export const LeadSwapModal: React.FC<LeadSwapModalProps> = ({
  isOpen,
  onClose,
  flow,
  targetMemberName,
  onConfirm,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOffer = flow === "offer";
  const title = isOffer
    ? `Offer Leadership to ${targetMemberName || "Teammate"}`
    : "Request Team Leadership";

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate leadership swap.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="rounded-xl bg-accent/10 border border-accent/20 p-3.5 text-sm">
          <p className="font-bold text-foreground">
            {isOffer ? "Safe Leadership Handover" : "Teammate Leadership Request"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {isOffer
              ? `You are offering full team leadership to ${targetMemberName}. If accepted, room leadership, request ownership, candidate applications, and waitlists will transfer atomically. You will remain an active team member.`
              : "You are requesting to become the project lead. The current lead will review your request. If approved, project ownership and management permissions will transfer to you."}
          </p>
        </div>

        <p className="text-sm text-foreground">
          {isOffer
            ? `Are you sure you want to transfer leadership to ${targetMemberName}? This request does not expire and will wait for their response.`
            : "Are you sure you want to request leadership for this team? The current lead will be notified."}
        </p>

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
            type="button"
            variant="primary"
            onClick={handleConfirm}
            isLoading={submitting}
          >
            {isOffer ? "Send Leadership Offer" : "Submit Request"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
