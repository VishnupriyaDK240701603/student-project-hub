"use client";

import React, { useState } from "react";
import { Dialog, Button, Input, useToast } from "@/components/ui";
import { EXPIRY_PRESETS, MIN_EXPIRY_HOURS, MAX_EXPIRY_HOURS, validateInviteExpiryHours } from "@/lib/invites-validation";
import { selectApplicant } from "@/server/actions/invites";
import type { ApplicationWithDetails } from "@/server/actions/applications";

interface SelectApplicantModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: ApplicationWithDetails | null;
  onSuccess: () => void;
}

export const SelectApplicantModal: React.FC<SelectApplicantModalProps> = ({
  isOpen,
  onClose,
  application,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState<number>(48);
  const [isCustom, setIsCustom] = useState(false);
  const [customHours, setCustomHours] = useState<string>("48");
  const [submitting, setSubmitting] = useState(false);

  if (!application) return null;

  const activeHours = isCustom ? parseInt(customHours, 10) || 0 : selectedPreset;

  const handlePresetClick = (hours: number) => {
    setSelectedPreset(hours);
    setIsCustom(false);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    setCustomHours(selectedPreset.toString());
  };

  const calculatePreviewDate = (): string => {
    const hours = activeHours;
    if (hours < MIN_EXPIRY_HOURS || hours > MAX_EXPIRY_HOURS) return "Invalid duration";
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmit = async () => {
    const validation = validateInviteExpiryHours(activeHours);
    if (!validation.valid) {
      showToast({
        type: "error",
        title: "Invalid Expiry Duration",
        description: validation.error || "Please choose a valid duration.",
      });
      return;
    }

    setSubmitting(true);
    const res = await selectApplicant(application.id, activeHours);
    setSubmitting(false);

    if (res.success) {
      showToast({
        type: "success",
        title: "Invitation Sent!",
        description: `Invite sent to ${application.profiles?.display_name || "Applicant"} with a ${activeHours}h expiry.`,
      });
      onSuccess();
      onClose();
    } else {
      showToast({
        type: "error",
        title: "Selection Failed",
        description: res.error || "Could not send invitation.",
      });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Send Team Invite"
      description={`Invite ${application.profiles?.display_name || "candidate"} to join your project team.`}
    >
      <div className="space-y-5 pt-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Invite Expiration Window
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EXPIRY_PRESETS.map((preset) => {
              const isSelected = !isCustom && selectedPreset === preset.hours;
              return (
                <button
                  key={preset.hours}
                  type="button"
                  onClick={() => handlePresetClick(preset.hours)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all text-left ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300 font-semibold"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={handleCustomToggle}
              className={`text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline ${
                isCustom ? "font-bold" : ""
              }`}
            >
              {isCustom ? "• Using Custom Duration" : "+ Specify Custom Expiry (Hours)"}
            </button>
          </div>

          {isCustom && (
            <div className="mt-2.5">
              <Input
                label="Custom Expiry in Hours (1 to 336 hours)"
                type="number"
                min={MIN_EXPIRY_HOURS}
                max={MAX_EXPIRY_HOURS}
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                placeholder="e.g. 36"
              />
            </div>
          )}
        </div>

        {/* Expiration date preview card */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2.5">
          <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Expires On: {calculatePreviewDate()}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              If unanswered, this invitation will automatically expire and notify you. Spots drop only when accepted.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={submitting}>
            Send Official Invite
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
