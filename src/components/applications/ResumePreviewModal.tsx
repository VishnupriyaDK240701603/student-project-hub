"use client";

import React, { useEffect, useState } from "react";
import { Dialog, Button } from "@/components/ui";
import { getSecureFileDownloadUrl } from "@/server/actions/applications";

export interface ResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName?: string;
  candidateName: string;
  candidateDepartment?: string;
  candidateYear?: string;
  candidateNote?: string | null;
}

export const ResumePreviewModal: React.FC<ResumePreviewModalProps> = ({
  isOpen,
  onClose,
  fileId,
  fileName,
  candidateName,
  candidateDepartment,
  candidateYear,
  candidateNote,
}) => {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolvedFileName, setResolvedFileName] = useState<string | null>(fileName || null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen || !fileId) {
      setPreviewUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchPreviewUrl = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSecureFileDownloadUrl(fileId, false);
        if (!isMounted) return;

        if (res.success && res.data?.downloadUrl) {
          setPreviewUrl(res.data.downloadUrl);
          if (res.data.fileName) setResolvedFileName(res.data.fileName);
          if (res.data.mimeType) setMimeType(res.data.mimeType);
        } else {
          setError(res.error || "Could not retrieve preview link.");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load document preview.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreviewUrl();

    return () => {
      isMounted = false;
    };
  }, [isOpen, fileId]);

  const handleDownload = async () => {
    if (!fileId) return;
    setIsDownloading(true);
    try {
      const res = await getSecureFileDownloadUrl(fileId, true);
      if (res.success && res.data?.downloadUrl) {
        const a = document.createElement("a");
        a.href = res.data.downloadUrl;
        a.download = res.data.fileName || resolvedFileName || "resume.pdf";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setError(res.error || "Failed to download file.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download error");
    } finally {
      setIsDownloading(false);
    }
  };

  const isPdf =
    mimeType === "application/pdf" ||
    (resolvedFileName && resolvedFileName.toLowerCase().endsWith(".pdf")) ||
    (!mimeType && !resolvedFileName); // Default assumption for resumes

  const isImage =
    mimeType?.startsWith("image/") ||
    Boolean(resolvedFileName?.match(/\.(png|jpe?g|webp|gif)$/i));

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Review Resume: ${candidateName}`}
      description={
        candidateDepartment
          ? `${candidateDepartment}${candidateYear ? ` • ${candidateYear}` : ""}`
          : "Candidate Application Attachment"
      }
      className="max-w-4xl"
    >
      <div className="space-y-4 pt-2 text-left">
        {/* Candidate note banner */}
        {candidateNote && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Candidate Note: </span>
            <span className="italic text-slate-600 dark:text-slate-400">&quot;{candidateNote}&quot;</span>
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl flex-wrap">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-lg">📄</span>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                {resolvedFileName || "Resume Document"}
              </p>
              {mimeType && (
                <p className="text-[11px] text-slate-500 truncate">{mimeType}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {previewUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewUrl, "_blank")}
                className="text-xs py-1 px-2.5 h-8 gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Tab
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              isLoading={isDownloading}
              className="text-xs py-1 px-3 h-8 bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            <p className="font-semibold">Unable to load preview:</p>
            <p className="mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="mt-3 text-xs"
            >
              Try Downloading Directly
            </Button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="h-96 flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500">Generating secure preview...</p>
          </div>
        )}

        {/* Preview Frame */}
        {!loading && !error && previewUrl && (
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-900 shadow-inner">
            {isPdf ? (
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                title="Resume Preview"
                className="w-full h-[580px] bg-slate-100 dark:bg-slate-900"
              />
            ) : isImage ? (
              <div className="p-4 flex items-center justify-center min-h-[400px] max-h-[580px] overflow-auto bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Resume preview"
                  className="max-h-[550px] w-auto object-contain rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center text-center gap-4 bg-slate-50 dark:bg-slate-900/60 min-h-[350px]">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl font-bold">
                  📄
                </div>
                <div className="max-w-md">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {resolvedFileName || "Document Attachment"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    This file format cannot be rendered inline in the browser. Click below to download or view it.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleDownload}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700"
                  >
                    Download File
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewUrl, "_blank")}
                    className="text-xs"
                  >
                    Open Externally ↗
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
