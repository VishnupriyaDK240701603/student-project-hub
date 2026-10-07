"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  getRoomFilesAction,
  uploadRoomFileAction,
  deleteRoomFileAction,
  getFileDownloadUrlAction,
  type RoomFileWithUploader,
} from "@/server/actions/chat";
import { APP_LIMITS } from "@/config/limits";
import { Button, Skeleton } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";

interface FilesTabProps {
  roomId: string;
  currentUserId: string;
  isLead: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getFileIcon(fileType: string): React.ReactNode {
  if (fileType.startsWith("image/")) {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (fileType.includes("pdf")) {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (fileType.includes("word") || fileType.includes("document")) {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

export const FilesTab: React.FC<FilesTabProps> = ({
  roomId,
  currentUserId,
  isLead,
}) => {
  const [files, setFiles] = useState<RoomFileWithUploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomFileWithUploader | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const res = await getRoomFilesAction(roomId);
    if (res.success && res.data) {
      setFiles(res.data);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return;

      setError(null);
      setUploading(true);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${selectedFiles.length})...`);

        try {
          // Convert to base64
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let j = 0; j < bytes.length; j++) {
            binary += String.fromCharCode(bytes[j]);
          }
          const base64 = btoa(binary);

          const res = await uploadRoomFileAction(
            roomId,
            file.name,
            file.type,
            file.size,
            base64,
          );

          if (!res.success) {
            setError(res.error || `Failed to upload ${file.name}`);
            break;
          }
        } catch {
          setError(`Upload failed for ${file.name}. Please try again.`);
          break;
        }
      }

      setUploading(false);
      setUploadProgress(null);
      await loadFiles();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [roomId, loadFiles],
  );

  const handleDownload = useCallback(async (fileId: string, fileName: string) => {
    const res = await getFileDownloadUrlAction(fileId);
    if (res.success && res.data) {
      const link = document.createElement("a");
      link.href = res.data.url;
      link.download = fileName;
      link.target = "_blank";
      link.click();
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteRoomFileAction(deleteTarget.id);
    if (res.success) {
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    } else {
      setError(res.error || "Failed to delete file.");
    }
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload],
  );

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-xl">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="w-20 h-8 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const allowedExts = APP_LIMITS.allowedFileExtensions.map((e) => e.toUpperCase().replace(".", "")).join(", ");

  return (
    <div
      className="space-y-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/40 hover:bg-accent/5"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={APP_LIMITS.allowedFileExtensions.join(",")}
          onChange={(e) => handleFileUpload(e.target.files)}
          disabled={uploading}
        />

        <div className="mx-auto w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        {uploading ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-accent">{uploadProgress}</p>
            <div className="w-32 h-1 mx-auto bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">
              {dragging ? "Drop files here" : "Click or drag files to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {allowedExts} · Max 10 MB per file
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-destructive/60 hover:text-destructive">✕</button>
        </div>
      )}

      {/* Files list */}
      {files.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-foreground">No files uploaded yet</h3>
          <p className="text-xs text-muted-foreground">Upload project files, documents, or images for your team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>
          </div>

          {files.map((file) => {
            const canDelete = file.uploaded_by === currentUserId || isLead;
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 border border-border rounded-xl bg-card/50 hover:bg-card transition-colors group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  {getFileIcon(file.file_type)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatFileSize(file.file_size_bytes)}</span>
                    <span>·</span>
                    <span>{file.profiles?.display_name || "Unknown"}</span>
                    <span>·</span>
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(file.id, file.file_name)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </Button>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(file)}
                    >
                      <svg className="w-4 h-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete File"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-foreground">{deleteTarget?.file_name}</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete File"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
