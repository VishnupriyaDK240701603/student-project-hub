"use client";

import React, { useState } from "react";
import { Dialog, Button, Input, useToast } from "@/components/ui";
import { raiseHeadcountAction } from "@/server/actions/invites";

interface RaiseHeadcountModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  currentHeadcount: number;
  onSuccess: () => void;
}

export const RaiseHeadcountModal: React.FC<RaiseHeadcountModalProps> = ({
  isOpen,
  onClose,
  requestId,
  currentHeadcount,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [newHeadcount, setNewHeadcount] = useState<string>((currentHeadcount + 1).toString());
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const val = parseInt(newHeadcount, 10);
    if (isNaN(val) || val <= currentHeadcount) {
      showToast({
        type: "error",
        title: "Invalid Headcount",
        description: `New headcount must be greater than current headcount (${currentHeadcount}).`,
      });
      return;
    }

    setSubmitting(true);
    const res = await raiseHeadcountAction(requestId, val);
    setSubmitting(false);

    if (res.success) {
      showToast({
        type: "success",
        title: "Headcount Raised",
        description: `Team headcount increased from ${currentHeadcount} to ${val}. Request has reopened for new spots.`,
      });
      onSuccess();
      onClose();
    } else {
      showToast({
        type: "error",
        title: "Failed to Raise Headcount",
        description: res.error || "An error occurred.",
      });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Raise Team Headcount"
      description="Expand your team capacity to welcome more student contributors. Headcounts can only be raised, not reduced."
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400">Current Headcount:</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentHeadcount} Members</span>
        </div>

        <Input
          label="New Target Headcount"
          type="number"
          min={currentHeadcount + 1}
          value={newHeadcount}
          onChange={(e) => setNewHeadcount(e.target.value)}
          placeholder={`e.g. ${currentHeadcount + 1}`}
          helperText={`Must be at least ${currentHeadcount + 1}.`}
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={submitting}>
            Confirm & Reopen Spots
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
