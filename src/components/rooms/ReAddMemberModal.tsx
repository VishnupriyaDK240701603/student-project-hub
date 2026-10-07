"use client";

import React, { useState, useEffect } from "react";
import { Dialog, Button, Avatar, Badge } from "@/components/ui";
import { getRoomEligibleReAddCandidatesAction } from "@/server/actions/room-management";

export interface ReAddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onConfirm: (targetUserId: string) => Promise<void>;
}

interface Candidate {
  id: string;
  display_name: string;
  department: string;
  status: string;
  removed_reason: string | null;
}

export const ReAddMemberModal: React.FC<ReAddMemberModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onConfirm,
}) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getRoomEligibleReAddCandidatesAction(roomId)
      .then((res) => {
        if (!mounted) return;
        if (res.success && res.data) {
          setCandidates(res.data);
        } else {
          setError(res.error || "Failed to load eligible candidates.");
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load candidates.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, roomId]);

  const handleReAdd = async (candidateId: string) => {
    setSubmittingId(candidateId);
    setError(null);
    try {
      await onConfirm(candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to re-add member.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Re-add Past Team Member">
      <div className="space-y-4">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="font-medium">Strict Re-add Invariant (Requirement 5)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can re-add only people who previously accepted an invitation to this project room. Blocked users are never eligible.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading past team members...
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No past members eligible to be re-added found.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-border">
            {candidates.map((c) => (
              <div key={c.id} className="pt-2 pb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={c.display_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.display_name}</p>
                    <p className="text-xs text-muted-foreground">{c.department}</p>
                    {c.status === "removed" && c.removed_reason && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 truncate mt-0.5" title={c.removed_reason}>
                        Past removal reason: {c.removed_reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "removed" ? "warning" : "neutral"} size="sm">
                    {c.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReAdd(c.id)}
                    isLoading={submittingId === c.id}
                    disabled={submittingId !== null}
                  >
                    Re-add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
