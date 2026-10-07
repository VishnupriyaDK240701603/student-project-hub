"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getModerationQueueAction,
  requestJustificationAction,
  dismissReportAction,
  blockUserAction,
  resolveAppealAction,
  type ReportWithDetails,
} from "@/server/actions/moderation";

export default function ModeratorConsolePage() {
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "under_review" | "appealed" | "blocked">("all");
  const [isPending, startTransition] = useTransition();

  // Modals / forms state
  const [selectedReport, setSelectedReport] = useState<ReportWithDetails | null>(null);
  const [justificationHours, setJustificationHours] = useState<number>(48);
  const [justificationAccusedId, setJustificationAccusedId] = useState<string>("");
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [dismissNote, setDismissNote] = useState("");
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getModerationQueueAction();
      if (!res.success || !res.data) {
        setError(res.error || "Failed to load moderation queue.");
      } else {
        setReports(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const handleRequestJustification = async () => {
    if (!selectedReport) return;
    setActionError(null);
    startTransition(async () => {
      const accusedId = justificationAccusedId || selectedReport.target_id;
      const res = await requestJustificationAction({
        reportId: selectedReport.id,
        accusedId,
        deadlineHours: justificationHours,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to request justification.");
      } else {
        setShowJustificationModal(false);
        loadQueue();
      }
    });
  };

  const handleDismiss = async () => {
    if (!selectedReport) return;
    setActionError(null);
    startTransition(async () => {
      const res = await dismissReportAction({
        reportId: selectedReport.id,
        note: dismissNote,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to dismiss report.");
      } else {
        setShowDismissModal(false);
        setDismissNote("");
        loadQueue();
      }
    });
  };

  const handleBlock = async (report: ReportWithDetails) => {
    if (!confirm(`Are you sure you want to permanently block user ${report.target_id}? This will immediately revoke their session.`)) {
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const res = await blockUserAction({
        reportId: report.id,
        accusedId: report.target_id,
        reason: "Permanent block following moderation review.",
      });

      if (!res.success) {
        setActionError(res.error || "Failed to block user.");
      } else {
        loadQueue();
      }
    });
  };

  const handleResolveAppeal = async (appealId: string, decision: "approved" | "rejected") => {
    if (!confirm(`Confirm ${decision.toUpperCase()} decision on this appeal?`)) return;
    setActionError(null);
    startTransition(async () => {
      const res = await resolveAppealAction({
        appealId,
        decision,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to resolve appeal.");
      } else {
        loadQueue();
      }
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Staff Moderator Console</h1>
              <Badge variant="accent">Confidential Queue</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              Review reported items, inspect immutable snapshots, request justifications, and resolve appeals.
            </p>
          </div>
          <Button variant="outline" onClick={loadQueue} disabled={loading || isPending}>
            {loading ? "Refreshing..." : "↻ Refresh Queue"}
          </Button>
        </div>

        {/* Global Error Banner */}
        {(error || actionError) && (
          <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 p-4 text-sm text-danger-400">
            {error || actionError}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800/80 pb-4">
          {(["all", "pending", "under_review", "appealed", "blocked"] as const).map((tab) => {
            const count = reports.filter((r) => tab === "all" || r.status === tab).length;
            const labels: Record<string, string> = {
              all: "All Reports",
              pending: "Pending Review",
              under_review: "Under Review",
              appealed: "Appeals",
              blocked: "Blocked Accounts",
            };
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                  filter === tab
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                }`}
              >
                <span>{labels[tab]}</span>
                <span className="rounded-full bg-neutral-700/60 px-2 py-0.5 text-xs text-neutral-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="py-20 text-center text-neutral-400">Loading moderation records...</div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 p-12 text-center text-neutral-400">
            No reports found for this filter.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReports.map((report) => {
              const statusColors: Record<string, "warning" | "accent" | "danger" | "success" | "neutral"> = {
                pending: "warning",
                under_review: "accent",
                appealed: "warning",
                blocked: "danger",
                dismissed: "neutral",
              };

              return (
                <div
                  key={report.id}
                  className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-5 transition hover:border-neutral-700"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={statusColors[report.status] || "neutral"}>
                        {report.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      <span className="text-sm text-neutral-400">Target Type:</span>
                      <Badge variant="neutral">{report.target_type}</Badge>
                      <span className="text-xs text-neutral-500">ID: {report.target_id}</span>
                    </div>
                    <div className="text-xs text-neutral-400">
                      Reported on {new Date(report.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                      Reporter Reason
                    </h4>
                    <p className="text-sm text-neutral-200 bg-neutral-950/60 rounded-xl p-3 border border-neutral-800/60">
                      {report.reason}
                    </p>
                  </div>

                  {/* Immutable Snapshot Data (Invariant D1: Never query room tables!) */}
                  {report.snapshot && (
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                        Captured Snapshot Evidence (Immutable)
                      </h4>
                      <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 text-xs font-mono text-neutral-300 max-h-56 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(report.snapshot.snapshot_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Justifications list */}
                  {report.justifications && report.justifications.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Justification Responses
                      </h4>
                      {report.justifications.map((j) => (
                        <div
                          key={j.id}
                          className="rounded-xl bg-neutral-950/80 border border-neutral-800 p-3 text-sm space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs text-neutral-400">
                            <span>Accused: {j.accused_id}</span>
                            <span>Deadline: {new Date(j.deadline).toLocaleString()}</span>
                          </div>
                          <div className="text-neutral-200">
                            {j.content ? (
                              j.content
                            ) : (
                              <span className="italic text-warning-400">No response received yet.</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Appeals list */}
                  {report.appeals && report.appeals.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-warning-400 uppercase tracking-wider">
                        Submitted Appeals
                      </h4>
                      {report.appeals.map((app) => (
                        <div
                          key={app.id}
                          className="rounded-xl bg-warning-950/20 border border-warning-500/30 p-4 text-sm space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-400">Appellant: {app.appellant_id}</span>
                            <Badge variant={app.status === "dismissed" ? "success" : app.status === "blocked" ? "danger" : "warning"}>
                              {app.status}
                            </Badge>
                          </div>
                          <div className="text-neutral-200">{app.reason}</div>
                          {app.status === "appealed" && (
                            <div className="flex items-center gap-3 pt-2">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleResolveAppeal(app.id, "approved")}
                                disabled={isPending}
                              >
                                Approve Appeal & Unblock
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleResolveAppeal(app.id, "rejected")}
                                disabled={isPending}
                              >
                                Reject Appeal
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-800/80">
                    {report.status !== "blocked" && report.status !== "dismissed" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedReport(report);
                            setJustificationAccusedId(report.target_id);
                            setShowJustificationModal(true);
                          }}
                          disabled={isPending}
                        >
                          Request Justification
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReport(report);
                            setShowDismissModal(true);
                          }}
                          disabled={isPending}
                        >
                          Dismiss Report
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleBlock(report)}
                          disabled={isPending}
                        >
                          Permanently Block User
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Justification Request Modal */}
      {showJustificationModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-neutral-100">Request Justification</h3>
            <p className="text-xs text-neutral-400">
              The accused user will be notified in their inbox and provided with a secure response form.
            </p>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Deadline Duration: {justificationHours} Hours ({Math.round(justificationHours / 24)} days)
              </label>
              <input
                type="range"
                min={24}
                max={168}
                step={24}
                value={justificationHours}
                onChange={(e) => setJustificationHours(Number(e.target.value))}
                className="w-full accent-accent-500"
              />
              <div className="flex justify-between text-xs text-neutral-500 mt-1">
                <span>24 hours (1 day)</span>
                <span>168 hours (7 days)</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowJustificationModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRequestJustification} disabled={isPending}>
                {isPending ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Modal */}
      {showDismissModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-neutral-100">Dismiss Report</h3>
            <p className="text-xs text-neutral-400">
              Mark this report as dismissed without taking action against the accused user.
            </p>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Optional Note</label>
              <textarea
                value={dismissNote}
                onChange={(e) => setDismissNote(e.target.value)}
                placeholder="Reason for dismissal..."
                rows={3}
                className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-3 text-sm text-neutral-100 focus:outline-none focus:border-accent-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDismissModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDismiss} disabled={isPending}>
                {isPending ? "Dismissing..." : "Confirm Dismissal"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
