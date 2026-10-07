"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getOwnerDataAction,
  addModeratorAction,
  removeModeratorAction,
  type ModeratorProfile,
} from "@/server/actions/owner";
import type { AuditLog } from "@/types/database.types";

export default function OwnerPage() {
  const [moderators, setModerators] = useState<ModeratorProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [canRemoveModerator, setCanRemoveModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add mod state
  const [newModEmail, setNewModEmail] = useState("");
  const [addModError, setAddModError] = useState<string | null>(null);
  const [addModSuccess, setAddModSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOwnerDataAction();
      if (!res.success || !res.data) {
        setError(res.error || "Failed to load owner data.");
      } else {
        setModerators(res.data.moderators);
        setAuditLogs(res.data.auditLogs);
        setCanRemoveModerator(res.data.canRemoveModerator);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddModerator = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModError(null);
    setAddModSuccess(false);

    startTransition(async () => {
      const res = await addModeratorAction(newModEmail);
      if (!res.success) {
        setAddModError(res.error || "Failed to add moderator.");
      } else {
        setAddModSuccess(true);
        setNewModEmail("");
        loadData();
      }
    });
  };

  const handleRemoveModerator = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove moderator role from ${name}?`)) return;

    startTransition(async () => {
      const res = await removeModeratorAction(userId);
      if (!res.success) {
        alert(res.error || "Failed to remove moderator.");
      } else {
        loadData();
      }
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10 space-y-10">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">System Owner Console</h1>
              <Badge variant="accent">Institutional Governance</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              Manage verified staff moderators and inspect the institutional audit log.
            </p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading || isPending}>
            {loading ? "Refreshing..." : "↻ Refresh Data"}
          </Button>
        </div>

        {/* Global Error */}
        {error && (
          <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 p-4 text-sm text-danger-400">
            {error}
          </div>
        )}

        {/* Top Grid: Moderator Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Moderator Form */}
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">Designate Moderator</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Assign moderator privileges to an existing staff member by institutional email.
              </p>
            </div>

            {addModError && (
              <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 p-3 text-xs text-danger-400">
                {addModError}
              </div>
            )}

            {addModSuccess && (
              <div className="rounded-xl bg-success-500/10 border border-success-500/30 p-3 text-xs text-success-400">
                ✓ Staff member successfully designated as moderator.
              </div>
            )}

            <form onSubmit={handleAddModerator} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Staff Email Address
                </label>
                <input
                  type="email"
                  value={newModEmail}
                  onChange={(e) => setNewModEmail(e.target.value)}
                  placeholder="staff.name@institution.edu"
                  className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent-500"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={isPending || !newModEmail.trim()}
              >
                {isPending ? "Assigning..." : "Assign Moderator Role"}
              </Button>
            </form>
          </div>

          {/* Active Moderators List */}
          <div className="lg:col-span-2 rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">Active Staff Moderators</h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Minimum 2 active moderators required for fair appeal processing. Current count: {moderators.length}
                </p>
              </div>
              <Badge variant={moderators.length >= 2 ? "success" : "danger"}>
                {moderators.length >= 2 ? "Policy Met (≥ 2)" : "Action Required (< 2)"}
              </Badge>
            </div>

            <div className="space-y-3">
              {moderators.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-neutral-950/70 border border-neutral-800"
                >
                  <div>
                    <div className="font-medium text-sm text-neutral-200">{mod.display_name}</div>
                    <div className="text-xs text-neutral-400">
                      {mod.email} • {mod.department}
                    </div>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveModerator(mod.user_id, mod.display_name)}
                      disabled={!canRemoveModerator || isPending}
                      title={
                        !canRemoveModerator
                          ? "Cannot remove: System requires at least 2 active moderators."
                          : "Remove moderator privilege"
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section: Audit Log Summary */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">System Audit Log Summary</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Read-only, immutable audit entries capturing sensitive events and governance actions.
              </p>
            </div>
            <Badge variant="neutral">Read-Only</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-900/40">
                    <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-accent-400">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400">
                      {log.actor_id || "System"}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-300">
                      {log.target}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400 max-w-xs truncate">
                      {JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
