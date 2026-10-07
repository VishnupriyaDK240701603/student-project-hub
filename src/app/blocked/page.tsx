"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { submitAppealAction, submitJustificationAction } from "@/server/actions/moderation";
import { MODERATION_LIMITS } from "@/lib/moderation-validation";

export default function BlockedPage() {
  const [appealReportId, setAppealReportId] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [justificationId, setJustificationId] = useState("");
  const [justificationContent, setJustificationContent] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await submitAppealAction({
        reportId: appealReportId,
        reason: appealReason,
      });

      if (!res.success) {
        setMessage({ text: res.error || "Failed to submit appeal.", type: "error" });
      } else {
        setMessage({
          text: "Your appeal has been submitted successfully. A different staff moderator will review your case.",
          type: "success",
        });
        setAppealReason("");
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Error submitting appeal.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleJustificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await submitJustificationAction({
        justificationId,
        content: justificationContent,
      });

      if (!res.success) {
        setMessage({ text: res.error || "Failed to submit justification.", type: "error" });
      } else {
        setMessage({
          text: "Your justification response has been recorded and submitted to moderation.",
          type: "success",
        });
        setJustificationContent("");
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Error submitting response.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl space-y-8">
        {/* Banner */}
        <div className="text-center space-y-3 border-b border-neutral-800 pb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-400 text-2xl">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Account Access Restricted</h1>
          <p className="text-sm text-neutral-400 max-w-md mx-auto">
            Your account has been restricted or flagged for moderation review. Please use the forms below to respond to
            justification requests or file a formal appeal.
          </p>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`rounded-xl p-4 text-sm border ${
              message.type === "success"
                ? "bg-success-500/10 border-success-500/30 text-success-400"
                : "bg-danger-500/10 border-danger-500/30 text-danger-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Justification Response Form */}
        <div className="rounded-xl bg-neutral-950/80 border border-neutral-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-200">Respond to Justification Request</h2>
            <Badge variant="accent">Response Form</Badge>
          </div>
          <form onSubmit={handleJustificationSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Justification Request ID
              </label>
              <input
                type="text"
                value={justificationId}
                onChange={(e) => setJustificationId(e.target.value)}
                placeholder="Paste the Justification ID from your notification email / notice"
                className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Your Response (Min {MODERATION_LIMITS.minJustificationLength} chars)
              </label>
              <textarea
                value={justificationContent}
                onChange={(e) => setJustificationContent(e.target.value)}
                rows={4}
                maxLength={MODERATION_LIMITS.maxJustificationLength}
                placeholder="Explain the circumstances clearly and factually..."
                className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent-500"
                required
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
              disabled={loading || justificationContent.trim().length < MODERATION_LIMITS.minJustificationLength}
            >
              {loading ? "Submitting..." : "Submit Justification Response"}
            </Button>
          </form>
        </div>

        {/* Appeal Submission Form */}
        <div className="rounded-xl bg-neutral-950/80 border border-neutral-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-200">Submit an Appeal</h2>
            <Badge variant="warning">Two-Moderator Review</Badge>
          </div>
          <p className="text-xs text-neutral-400">
            If your account was blocked, you can request an independent appeal review. Under institutional policy, your
            appeal will be evaluated by a different moderator than the one who initially reviewed your account.
          </p>
          <form onSubmit={handleAppealSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Report ID</label>
              <input
                type="text"
                value={appealReportId}
                onChange={(e) => setAppealReportId(e.target.value)}
                placeholder="Enter the Report ID"
                className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Reason for Appeal (Min {MODERATION_LIMITS.minAppealReasonLength} chars)
              </label>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={4}
                maxLength={MODERATION_LIMITS.maxAppealReasonLength}
                placeholder="Explain why the block should be reconsidered..."
                className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent-500"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || appealReason.trim().length < MODERATION_LIMITS.minAppealReasonLength}
            >
              {loading ? "Submitting..." : "Submit Formal Appeal"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
