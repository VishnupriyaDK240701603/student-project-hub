"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import {
  validateUploadFile,
  generateSecureStoragePath,
  MockFileScanner,
} from "@/lib/storage/upload-validation";
import type { Application, ApplicationFile } from "@/types/database.types";

export interface SubmitApplicationInput {
  requestId: string;
  note?: string;
  file?: {
    name: string;
    type: string;
    size: number;
    base64Data?: string; // For client upload passing
  };
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Submit an application to a team request
 */
export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<ActionResult<{ application: Application; file?: ApplicationFile }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // 1. Check user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("kind, admission_year, department, gender, is_blocked, is_deactivated")
    .eq("id", user.id)
    .single();

  if (!profile || profile.kind !== "student") {
    return { success: false, error: "Only students can apply to project teams." };
  }

  if (profile.is_blocked || profile.is_deactivated) {
    return { success: false, error: "Your account is restricted from applying." };
  }

  // 2. Fetch the target request
  const { data: request, error: reqError } = await supabase
    .from("team_requests")
    .select("*")
    .eq("id", input.requestId)
    .single();

  if (reqError || !request) {
    return { success: false, error: "Team request not found." };
  }

  if (request.status !== "open") {
    return { success: false, error: "This team request is no longer accepting applications." };
  }

  // 3. Invariant: Cannot apply to your own request
  if (request.lead_id === user.id) {
    return { success: false, error: "You cannot apply to your own project request." };
  }

  // 4. Invariant: Check eligibility against filters
  if (request.filter_years && request.filter_years.length > 0) {
    if (profile.admission_year === null || !request.filter_years.includes(profile.admission_year)) {
      return { success: false, error: "You do not meet the year eligibility for this request." };
    }
  }

  if (request.filter_departments && request.filter_departments.length > 0) {
    if (!request.filter_departments.includes(profile.department.toLowerCase())) {
      return { success: false, error: "You do not meet the department eligibility for this request." };
    }
  }

  if (request.filter_genders && request.filter_genders.length > 0) {
    if (
      profile.gender === "other" ||
      profile.gender === "prefer_not_to_say" ||
      !request.filter_genders.includes(profile.gender)
    ) {
      return { success: false, error: "You do not meet the gender eligibility for this request." };
    }
  }

  // 5. Invariant: One application per student per request
  const { data: existingApp } = await supabase
    .from("applications")
    .select("id, status")
    .eq("request_id", input.requestId)
    .eq("applicant_id", user.id)
    .maybeSingle();

  if (existingApp && existingApp.status !== "withdrawn") {
    return { success: false, error: "You have already applied to this project request." };
  }

  // 6. Resume requirement check
  if (request.resume_required && !input.file) {
    return { success: false, error: "A resume or portfolio attachment is required for this request." };
  }

  // 7. Validate file if provided
  let fileBuffer: Buffer | null = null;
  if (input.file) {
    if (input.file.base64Data) {
      fileBuffer = Buffer.from(input.file.base64Data, "base64");
    }

    const validation = validateUploadFile(
      input.file.name,
      input.file.type,
      input.file.size,
      fileBuffer ? new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, Math.min(fileBuffer.length, 32)) : undefined,
    );

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Antivirus scanner check
    const scanner = new MockFileScanner();
    const scanResult = await scanner.scan(
      fileBuffer ? new Uint8Array(fileBuffer) : new Uint8Array(),
      input.file.name,
    );
    if (!scanResult.clean) {
      return { success: false, error: `File failed security scan: ${scanResult.threat}` };
    }
  }

  const cleanNote = input.note ? sanitizeText(input.note).slice(0, 500) : null;

  // 8. Create Application record
  const { data: application, error: appError } = await supabase
    .from("applications")
    .insert({
      request_id: input.requestId,
      applicant_id: user.id,
      note: cleanNote,
      status: "applied",
    })
    .select()
    .single();

  if (appError || !application) {
    return { success: false, error: appError?.message || "Failed to submit application." };
  }

  // 9. Upload file if present
  let fileRecord: ApplicationFile | undefined;
  if (input.file && fileBuffer) {
    const storagePath = generateSecureStoragePath(application.id, input.file.name);

    // Upload to private Supabase storage bucket
    let { error: uploadError } = await supabase.storage
      .from("application-files")
      .upload(storagePath, fileBuffer, {
        contentType: input.file.type,
        upsert: false,
      });

    // Auto-create bucket if missing in Supabase Storage and retry
    if (
      uploadError &&
      (uploadError.message?.toLowerCase().includes("bucket not found") ||
        (uploadError as unknown as { statusCode?: string }).statusCode === "404")
    ) {
      await supabase.storage.createBucket("application-files", {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });

      const retryResult = await supabase.storage
        .from("application-files")
        .upload(storagePath, fileBuffer, {
          contentType: input.file.type,
          upsert: true,
        });

      uploadError = retryResult.error;
    }

    if (uploadError) {
      // Rollback application record if upload fails
      await supabase.from("applications").delete().eq("id", application.id);
      return { success: false, error: `Storage upload failed: ${uploadError.message}` };
    }

    // Insert file metadata
    const { data: dbFile, error: fileDbError } = await supabase
      .from("application_files")
      .insert({
        application_id: application.id,
        uploader_id: user.id,
        storage_path: storagePath,
        file_name: input.file.name,
        file_size_bytes: input.file.size,
        mime_type: input.file.type || "application/octet-stream",
      })
      .select()
      .single();

    if (fileDbError) {
      // Rollback application and storage file if DB metadata insertion fails
      await supabase.storage.from("application-files").remove([storagePath]);
      await supabase.from("applications").delete().eq("id", application.id);
      return { success: false, error: `Failed to save file metadata: ${fileDbError.message}` };
    }

    if (dbFile) {
      fileRecord = dbFile as ApplicationFile;
    }
  }

  return {
    success: true,
    data: {
      application: application as Application,
      file: fileRecord,
    },
  };
}

/**
 * Withdraw an application and hard-delete its associated files
 */
export async function withdrawApplication(
  applicationId: string,
): Promise<ActionResult<{ withdrawn: boolean }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Fetch application ensuring user owns it
  const { data: app } = await supabase
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .single();

  if (!app || app.applicant_id !== user.id) {
    return { success: false, error: "Application not found or unauthorized." };
  }

  // Hard delete associated files from storage
  const { data: files } = await supabase
    .from("application_files")
    .select("id, storage_path")
    .eq("application_id", applicationId);

  if (files && files.length > 0) {
    const paths = files.map((f) => f.storage_path);
    await supabase.storage.from("application-files").remove(paths);
    await supabase.from("application_files").delete().eq("application_id", applicationId);
  }

  // Delete the application row
  const { error: deleteError } = await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  return { success: true, data: { withdrawn: true } };
}

export interface ApplicantProfileDetails {
  display_name: string;
  department: string;
  admission_year: number | null;
  gender: string;
}

export interface ApplicationWithDetails extends Application {
  profiles: ApplicantProfileDetails | null;
  application_files: ApplicationFile[];
}

/**
 * Fetch all applications for a request (Lead view only)
 */
export async function getApplicationsForRequest(
  requestId: string,
): Promise<ActionResult<ApplicationWithDetails[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify caller is request lead
  const { data: request } = await supabase
    .from("team_requests")
    .select("lead_id")
    .eq("id", requestId)
    .single();

  if (!request || request.lead_id !== user.id) {
    return { success: false, error: "Only the project lead can view applications." };
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*, profiles:applicant_id(display_name, department, admission_year, gender), application_files(*)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as ApplicationWithDetails[] };
}

/**
 * Generate a short-lived signed URL for viewing or downloading an application file.
 */
export async function getSecureFileDownloadUrl(
  fileId: string,
  download: boolean = false,
): Promise<ActionResult<{ downloadUrl: string; fileName?: string; mimeType?: string }>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  // Fetch file record
  const { data: fileRecord, error: fileError } = await supabase
    .from("application_files")
    .select("id, storage_path, application_id, file_name, mime_type")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError || !fileRecord) {
    return { success: false, error: "File record not found or access denied." };
  }

  const downloadParam = download ? (fileRecord.file_name || true) : false;

  // 1. Try application-files bucket
  let { data: signData, error: signError } = await supabase.storage
    .from("application-files")
    .createSignedUrl(fileRecord.storage_path, 3600, {
      download: downloadParam,
    });

  // 2. Fallback to resumes bucket if missing
  if (signError || !signData?.signedUrl) {
    const retry = await supabase.storage
      .from("resumes")
      .createSignedUrl(fileRecord.storage_path, 3600, {
        download: downloadParam,
      });
    signData = retry.data;
    signError = retry.error;
  }

  if (signError || !signData?.signedUrl) {
    return { success: false, error: signError?.message || "Failed to generate file link." };
  }

  return {
    success: true,
    data: {
      downloadUrl: signData.signedUrl,
      fileName: fileRecord.file_name || undefined,
      mimeType: fileRecord.mime_type || undefined,
    },
  };
}

export interface MyApplicationItem extends Application {
  team_requests: {
    id: string;
    title: string;
    description: string;
    role_needed: string;
    department: string;
    headcount: number;
    status: string;
    room_id: string | null;
    lead_id: string;
    profiles?: {
      display_name: string;
      department: string;
      admission_year: number | null;
    } | null;
  } | null;
  application_files: ApplicationFile[];
}

/**
 * Fetch all applications submitted by the current authenticated user
 */
export async function getMyApplicationsAction(): Promise<ActionResult<MyApplicationItem[]>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized: Please sign in." };
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*, team_requests(*, profiles:lead_id(display_name, department, admission_year)), application_files(*)")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as unknown as MyApplicationItem[] };
}

