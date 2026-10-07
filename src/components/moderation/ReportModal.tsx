"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createReportAction } from "@/server/actions/moderation";
import { MODERATION_LIMITS } from "@/lib/moderation-validation";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "user" | "request" | "message";
  targetId: string;
  targetTitle?: string;
  selectedMessageIds?: string[];
  onReportSubmitted?: (reportId: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  selectedMessageIds = [],
  onReportSubmitted,
}) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createReportAction({
        target_type: targetType,
        target_id: targetId,
        reason,
        selected_message_ids: selectedMessageIds,
      });

      if (!res.success || !res.data) {
        setError(res.error || "Failed to submit report.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      if (onReportSubmitted) {
        onReportSubmitted(res.data.reportId);
      }
      setTimeout(() => {
        setSuccess(false);
        setReason("");
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-neutral-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-100">Submit Report</h2>
            <Badge variant="danger">{targetType}</Badge>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-800 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {targetTitle && (
          <div className="mt-3 text-sm text-neutral-400">
            Reporting: <span className="font-medium text-neutral-200">{targetTitle}</span>
          </div>
        )}

        {selectedMessageIds.length > 0 && (
          <div className="mt-2 text-xs text-neutral-400">
            {selectedMessageIds.length} message snapshot(s) will be attached as confidential evidence.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-danger-500/10 border border-danger-500/30 p-3 text-sm text-danger-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl bg-success-500/10 border border-success-500/30 p-3 text-sm text-success-400">
            ✓ Report submitted confidentially to staff moderators.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Reason / Details (Minimum {MODERATION_LIMITS.minReasonLength} characters)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading || success}
              rows={4}
              maxLength={MODERATION_LIMITS.maxReasonLength}
              placeholder="Describe the policy violation or abusive behavior concisely..."
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent-500 transition"
              required
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>Must be objective and factual</span>
              <span>{reason.length} / {MODERATION_LIMITS.maxReasonLength}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || success}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={loading || success || reason.trim().length < MODERATION_LIMITS.minReasonLength}
            >
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
