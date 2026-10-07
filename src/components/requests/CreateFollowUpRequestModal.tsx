"use client";

import React, { useState } from "react";
import {
  Dialog,
  Button,
  Input,
  Textarea,
  Checkbox,
  Chip,
  useToast,
} from "@/components/ui";
import { createFollowUpRequestAction } from "@/server/actions/rooms";

interface CreateFollowUpRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  projectTitle: string;
  onSuccess: () => void;
}

export const CreateFollowUpRequestModal: React.FC<CreateFollowUpRequestModalProps> = ({
  isOpen,
  onClose,
  roomId,
  projectTitle,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [roleNeeded, setRoleNeeded] = useState("");
  const [extraHeadcount, setExtraHeadcount] = useState("1");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [resumeRequired, setResumeRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 6) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async () => {
    const count = parseInt(extraHeadcount, 10);
    if (isNaN(count) || count < 1) {
      showToast({
        type: "error",
        title: "Invalid Headcount",
        description: "Please specify at least 1 extra member needed.",
      });
      return;
    }

    if (roleNeeded.trim().length < 3) {
      showToast({
        type: "error",
        title: "Role Required",
        description: "Please specify the specialty or role needed (min 3 characters).",
      });
      return;
    }

    if (description.trim().length < 15) {
      showToast({
        type: "error",
        title: "Description Required",
        description: "Please provide a project description and current status (min 15 characters).",
      });
      return;
    }

    setSubmitting(true);
    const res = await createFollowUpRequestAction({
      roomId,
      roleNeeded: roleNeeded.trim(),
      extraHeadcount: count,
      description: description.trim(),
      tags,
      resumeRequired,
    });
    setSubmitting(false);

    if (res.success) {
      showToast({
        type: "success",
        title: "Follow-up Request Published!",
        description: "Candidates accepted from this request will join your existing room automatically.",
      });
      onSuccess();
      onClose();
    } else {
      showToast({
        type: "error",
        title: "Failed to Publish",
        description: res.error || "Could not publish follow-up request.",
      });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create Follow-up Team Request"
      description={`Add additional roles for "${projectTitle}". Confirmed members join your active room automatically.`}
    >
      <div className="space-y-4 pt-2">
        <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
          <p className="font-semibold">Linked Project Room:</p>
          <p className="mt-0.5">
            This request links to your existing team room. Existing room members will be notified when new members join.
          </p>
        </div>

        <Input
          label="New Role / Specialty Needed"
          placeholder="e.g. Flutter Mobile Developer"
          value={roleNeeded}
          onChange={(e) => setRoleNeeded(e.target.value)}
        />

        <Input
          label="Extra People Needed"
          type="number"
          min={1}
          max={10}
          value={extraHeadcount}
          onChange={(e) => setExtraHeadcount(e.target.value)}
          helperText="Number of students to recruit for this specific role."
        />

        <Textarea
          label="Project Status & Role Description"
          rows={3}
          placeholder="Describe the current progress of the project and responsibilities for this role..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          helperText={`${description.length} characters (min 15)`}
        />

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Skills & Technologies (Max 6)
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. PyTorch"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || tags.length >= 6}
            >
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  variant="accent"
                  onRemove={() => handleRemoveTag(tag)}
                />
              ))}
            </div>
          )}
        </div>

        <Checkbox
          id="followup-resume-req"
          label="Require resume attachment for applicants"
          checked={resumeRequired}
          onChange={(e) => setResumeRequired(e.target.checked)}
        />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={submitting}>
            Publish Follow-up Request
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
