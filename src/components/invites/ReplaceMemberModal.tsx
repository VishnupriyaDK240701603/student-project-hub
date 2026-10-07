"use client";

import React, { useState } from "react";
import { Dialog, Button, Textarea, useToast } from "@/components/ui";
import { validateReplacementReason } from "@/lib/invites-validation";
import { replaceMemberAction } from "@/server/actions/invites";
import type { ApplicationWithDetails } from "@/server/actions/applications";

interface ReplaceMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  member: ApplicationWithDetails | null;
  onSuccess: () => void;
}

export const ReplaceMemberModal: React.FC<ReplaceMemberModalProps> = ({
  isOpen,
  onClose,
  requestId,
  member,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!member) return null;

  const handleSubmit = async () => {
    const validation = validateReplacementReason(reason);
    if (!validation.valid) {
      showToast({
        type: "error",
        title: "Reason Required",
        description: validation.error || "Please provide a valid reason.",
      });
      return;
    }

    setSubmitting(true);
    const res = await replaceMemberAction(requestId, member.id, reason);
    setSubmitting(false);

    if (res.success) {
      showToast({
        type: "success",
        title: "Member Replaced",
        description: `${member.profiles?.display_name || "Member"} removed from team. Spot has reopened.`,
      });
      onSuccess();
      onClose();
    } else {
      showToast({
        type: "error",
        title: "Failed to Remove Member",
        description: res.error || "An error occurred.",
      });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Replace Team Member"
      description={`Remove ${member.profiles?.display_name || "member"} and reopen their spot for a new applicant.`}
    >
      <div className="space-y-4 pt-2">
        <div className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300">
          <p className="font-semibold">Accountability Notice:</p>
          <p className="mt-0.5">
            A written reason is required and will be logged in the audit trail and sent to the student.
          </p>
        </div>

        <div>
          <Textarea
            label="Reason for Removal (Minimum 10 characters)"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this member is being replaced (e.g., Unresponsive to team milestones for 2 weeks, withdrew from project)..."
            helperText={`${reason.length}/500 characters (min 10)`}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSubmit}
            isLoading={submitting}
            disabled={reason.trim().length < 10}
          >
            Confirm Removal & Reopen Spot
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
