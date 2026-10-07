"use client";

import React, { useState, useEffect } from "react";
import { Dialog, Button, Avatar, Badge, Input } from "@/components/ui";
import {
  searchStaffAction,
  inviteStaffMentorAction,
  type StaffSearchResult,
} from "@/server/actions/mentors";
import { MENTOR_EXPIRY_PRESETS } from "@/lib/mentor-validation";
import { APP_LIMITS } from "@/config/limits";
import { collegeConfig } from "../../../college.config";

export interface InviteMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  projectTitle: string;
  onSuccess: () => Promise<void>;
}

export const InviteMentorModal: React.FC<InviteMentorModalProps> = ({
  isOpen,
  onClose,
  roomId,
  projectTitle,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [staffResults, setStaffResults] = useState<StaffSearchResult[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffSearchResult | null>(null);
  const [expiryHours, setExpiryHours] = useState<number>(48);
  const [note, setNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search staff with debounce
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const res = await searchStaffAction(
          searchTerm,
          selectedDept !== "all" ? selectedDept : undefined,
        );
        if (active && res.success && res.data) {
          setStaffResults(res.data);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Failed to search staff.");
      } finally {
        if (active) setSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchTerm, selectedDept]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) {
      setError("Please select a faculty staff member to invite.");
      return;
    }

    if (selectedStaff.pendingInviteCount >= APP_LIMITS.maxPendingMentorInvitesPerStaff) {
      setError(`This staff member already has the maximum of ${APP_LIMITS.maxPendingMentorInvitesPerStaff} pending invites.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await inviteStaffMentorAction({
        roomId,
        staffId: selectedStaff.id,
        expiryHours,
        note: note.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to send mentor invitation.");
        return;
      }

      await onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error sending invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Invite Faculty Mentor to ${projectTitle}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-900 dark:text-indigo-200">
          <p className="font-semibold">Faculty Mentor Role (Spec F12, Invariant 4)</p>
          <p className="mt-1 text-muted-foreground">
            Mentors have advisory access with chat and dashboard progress view. Mentors do NOT count toward student headcount and cannot become team lead. Staff can have at most 10 pending invitations.
          </p>
        </div>

        {/* Search controls */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-foreground uppercase tracking-wide">
            1. Search Faculty / Staff Member
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <Input
                placeholder="Search staff by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Departments</option>
              {Object.entries(collegeConfig.departments).map(([code, name]) => (
                <option key={code} value={code.toUpperCase()}>
                  {code.toUpperCase()} - {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Staff Results List */}
        <div className="border rounded-lg bg-card max-h-48 overflow-y-auto divide-y divide-border">
          {searching ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Searching staff...</div>
          ) : staffResults.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No staff members found matching search.
            </div>
          ) : (
            staffResults.map((staff) => {
              const isSelected = selectedStaff?.id === staff.id;
              const isAtLimit = staff.pendingInviteCount >= APP_LIMITS.maxPendingMentorInvitesPerStaff;

              return (
                <div
                  key={staff.id}
                  onClick={() => !isAtLimit && setSelectedStaff(staff)}
                  className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                    isAtLimit
                      ? "opacity-50 cursor-not-allowed bg-muted/20"
                      : isSelected
                      ? "bg-accent/10 border-l-4 border-accent cursor-pointer"
                      : "hover:bg-muted/40 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={staff.display_name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{staff.display_name}</p>
                      <p className="text-[11px] text-muted-foreground">{staff.department} · {staff.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAtLimit ? (
                      <Badge variant="danger" size="sm">
                        Max 10 Pending
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {staff.pendingInviteCount}/10 pending
                      </span>
                    )}
                    {isSelected && (
                      <Badge variant="accent" size="sm">
                        Selected
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Staff Banner */}
        {selectedStaff && (
          <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
            <span className="text-emerald-800 dark:text-emerald-200">
              Selected: <strong>{selectedStaff.display_name}</strong> ({selectedStaff.department})
            </span>
            <button
              type="button"
              onClick={() => setSelectedStaff(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>
        )}

        {/* Expiry Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-foreground uppercase tracking-wide">
            2. Set Invitation Expiry
          </label>
          <div className="flex flex-wrap gap-2">
            {MENTOR_EXPIRY_PRESETS.map((preset) => (
              <button
                key={preset.hours}
                type="button"
                onClick={() => setExpiryHours(preset.hours)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  expiryHours === preset.hours
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-background border-border text-foreground hover:bg-muted"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Note */}
        <div className="space-y-1">
          <label htmlFor="mentor-note" className="block text-xs font-medium text-foreground">
            Note to Faculty Member (Optional)
          </label>
          <textarea
            id="mentor-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Briefly explain your project focus or why you are requesting their guidance..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!selectedStaff || submitting}
            isLoading={submitting}
          >
            Send Mentor Invitation
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
