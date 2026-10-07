"use client";

import React, { useState } from "react";
import { Dialog, Button, Textarea, useToast } from "@/components/ui";
import { submitApplication } from "@/server/actions/applications";
import { validateUploadFile } from "@/lib/storage/upload-validation";
import type { TeamRequest } from "@/types/database.types";

export interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TeamRequest;
  onSuccess: () => void;
}

export const ApplyModal: React.FC<ApplyModalProps> = ({
  isOpen,
  onClose,
  request,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [note, setNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Inspect first 32 bytes for signature validation
    const slice = file.slice(0, 32);
    const arrayBuffer = await slice.arrayBuffer();
    const headerBytes = new Uint8Array(arrayBuffer);

    const validation = validateUploadFile(file.name, file.type, file.size, headerBytes);
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file format or size.");
      e.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setServerError(null);

    if (request.resume_required && !selectedFile) {
      setServerError("A resume or document attachment is required for this request.");
      setLoading(false);
      return;
    }

    let fileData: { name: string; type: string; size: number; base64Data: string } | undefined;
    if (selectedFile) {
      const buffer = await selectedFile.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      fileData = {
        name: selectedFile.name,
        type: selectedFile.type || "application/octet-stream",
        size: selectedFile.size,
        base64Data: base64,
      };
    }

    const res = await submitApplication({
      requestId: request.id,
      note,
      file: fileData,
    });

    setLoading(false);

    if (!res.success) {
      setServerError(res.error || "Failed to submit application.");
      return;
    }

    showToast({
      type: "success",
      title: "Application Submitted!",
      description: "The team lead has received your note and application.",
    });

    onSuccess();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Apply for ${request.role_needed}`}
      description={`Submit your interest to the project lead for "${request.title}".`}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-left">
        {serverError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {serverError}
          </div>
        )}

        <Textarea
          label="Introductory Note / Message to Lead"
          placeholder="Briefly state your relevant background, skills, and availability..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          showCount
          helperText="Maximum 500 characters."
        />

        {/* File Upload Area */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Resume / Portfolio Document
            {request.resume_required && <span className="text-red-500 ml-1">*</span>}
          </label>

          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center bg-slate-50/50 dark:bg-slate-900/50">
            <input
              type="file"
              id="app-file-upload"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="app-file-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {selectedFile ? selectedFile.name : "Click to select a file"}
              </span>
              <span className="text-[11px] text-slate-400">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                  : "PDF, Word, PPT, Excel, Images, or TXT (Max 10 MB). Zip and executables blocked."}
              </span>
            </label>
          </div>

          {fileError && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {fileError}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={loading}>
            Submit Application
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
