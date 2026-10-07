"use client";

import React, { useState } from "react";
import {
  Dialog,
  Button,
  Input,
  Textarea,
  Checkbox,
  Chip,
  Select,
  useToast,
} from "@/components/ui";
import { createTeamRequest } from "@/server/actions/requests";
import { studyLevelToAdmissionYear } from "@/lib/academic-year";
import { collegeConfig } from "../../../college.config";
import type { TeamRequest, GenderEnum } from "@/types/database.types";

export interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (request: TeamRequest) => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roleNeeded, setRoleNeeded] = useState("");
  const [headcount, setHeadcount] = useState(2);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [resumeRequired, setResumeRequired] = useState(false);

  // Filters
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<GenderEnum[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to add tag
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^,+|,+$/g, "");
      if (clean && !tags.includes(clean) && tags.length < 10) {
        setTags([...tags, clean.slice(0, 30)]);
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const toggleYear = (level: number) => {
    const admissionYear = studyLevelToAdmissionYear(level);
    if (selectedYears.includes(admissionYear)) {
      setSelectedYears(selectedYears.filter((y) => y !== admissionYear));
    } else {
      setSelectedYears([...selectedYears, admissionYear]);
    }
  };

  const toggleDept = (code: string) => {
    if (selectedDepts.includes(code)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== code));
    } else {
      setSelectedDepts([...selectedDepts, code]);
    }
  };

  const toggleGender = (gender: GenderEnum) => {
    if (selectedGenders.includes(gender)) {
      setSelectedGenders(selectedGenders.filter((g) => g !== gender));
    } else {
      setSelectedGenders([...selectedGenders, gender]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createTeamRequest({
      title,
      description,
      role_needed: roleNeeded,
      headcount,
      tags,
      filter_years: selectedYears,
      filter_departments: selectedDepts,
      filter_genders: selectedGenders,
      resume_required: resumeRequired,
    });

    setLoading(false);

    if (!res.success || !res.data) {
      setError(res.error || "Failed to create request.");
      return;
    }

    showToast({
      type: "success",
      title: "Request Created!",
      description: "Your team request is now live in the college feed.",
    });

    onSuccess(res.data);
    onClose();
  };

  const departmentsList = Object.entries(collegeConfig.departments || {});

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create Team Request"
      description="Post an open role for your project. Only eligible college students will be able to see and apply."
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-left pt-2">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <Input
          label="Project Title"
          placeholder="e.g. Autonomous Campus Delivery Rover"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          helperText="A clear, compelling title (5 - 100 characters)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Role Needed"
            placeholder="e.g. Embedded Firmware Engineer"
            value={roleNeeded}
            onChange={(e) => setRoleNeeded(e.target.value)}
            required
            helperText="The primary specialty you are seeking"
          />

          <Select
            label="Headcount (Spots Needed)"
            value={headcount.toString()}
            onChange={(e) => setHeadcount(Number(e.target.value))}
            options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
              value: n.toString(),
              label: `${n} Member${n > 1 ? "s" : ""}`,
            }))}
            helperText="How many teammates you wish to select"
          />
        </div>

        <Textarea
          label="Project Description & Deliverables"
          placeholder="Explain the project scope, technical stack, timeline, and candidate requirements..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          maxLength={2000}
          showCount
        />

        {/* Skill Tags */}
        <div className="space-y-2">
          <Input
            label="Required Skills / Tags"
            placeholder="Type skill and press Enter (e.g. ROS2, C++, PCB Design)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            helperText="Add up to 10 tags. Press Enter or comma to insert."
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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

        {/* Eligibility Restrictions Section */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Eligibility Filters (Optional)
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Leave empty to allow all students. If specified, only matching students will see this in their feed.
            </p>
          </div>

          {/* Year level checkboxes */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Allowed Year of Study:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { level: 1, label: "1st Year" },
                { level: 2, label: "2nd Year" },
                { level: 3, label: "3rd Year" },
                { level: 4, label: "4th Year" },
              ].map(({ level, label }) => {
                const admissionYear = studyLevelToAdmissionYear(level);
                const checked = selectedYears.includes(admissionYear);
                return (
                  <Checkbox
                    key={level}
                    label={label}
                    checked={checked}
                    onChange={() => toggleYear(level)}
                  />
                );
              })}
            </div>
          </div>

          {/* Department checkboxes */}
          {departmentsList.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Allowed Departments:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {departmentsList.map(([code, name]) => (
                  <Checkbox
                    key={code}
                    label={<span className="text-xs">{name} ({code.toUpperCase()})</span>}
                    checked={selectedDepts.includes(code)}
                    onChange={() => toggleDept(code)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Gender checkboxes */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Gender Restriction:
            </p>
            <div className="flex items-center gap-6">
              <Checkbox
                label="Female Students Only"
                checked={selectedGenders.includes("female")}
                onChange={() => toggleGender("female")}
              />
              <Checkbox
                label="Male Students Only"
                checked={selectedGenders.includes("male")}
                onChange={() => toggleGender("male")}
              />
            </div>
          </div>
        </div>

        {/* Resume Required Toggle */}
        <Checkbox
          label="Require resume or project portfolio attachment when applying"
          helperText="Applicants will be prompted to upload a PDF or document (max 10 MB)."
          checked={resumeRequired}
          onChange={(e) => setResumeRequired(e.target.checked)}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={loading}>
            Publish Request
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
