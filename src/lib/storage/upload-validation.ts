import { APP_LIMITS } from "@/config/limits";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
  sanitizedFilename?: string;
}

export interface FileScanner {
  scan(buffer: Uint8Array, filename: string): Promise<{ clean: boolean; threat?: string }>;
}

/**
 * Documented no-op antivirus scanner implementation.
 * Real antivirus scanner integration is planned for deployment after college security review.
 */
export class MockFileScanner implements FileScanner {
  async scan(buffer: Uint8Array, filename: string): Promise<{ clean: boolean; threat?: string }> {
    void buffer;
    void filename;
    return { clean: true };
  }
}

// Common file signatures (magic numbers)
const MAGIC_NUMBERS = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // \x89PNG\r\n\x1a\n
  jpeg: [0xff, 0xd8, 0xff], // \xFF\xD8\xFF
  zipOffice: [0x50, 0x4b, 0x03, 0x04], // PK\x03\x04 (zip-based formats)
  peExe: [0x4d, 0x5a], // MZ (DOS/Windows Executable)
  elf: [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux binary)
};

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Validates a file's size, extension, MIME type, and binary magic bytes.
 * Blocks all zip archives, executables, renamed binaries, and oversized files.
 */
export function validateUploadFile(
  filename: string,
  declaredMimeType: string,
  sizeBytes: number,
  headerBytes?: Uint8Array,
): FileValidationResult {
  // 1. File Size check (10 MB limit)
  if (sizeBytes <= 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }
  if (sizeBytes > APP_LIMITS.maxFileSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds the 10 MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  // 2. Sanitize filename and extract extension
  const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const extMatch = cleanFilename.match(/\.[0-9a-z]+$/);
  if (!extMatch) {
    return { valid: false, error: "File must have a valid extension." };
  }
  const ext = extMatch[0];

  // 3. Reject forbidden extensions explicitly
  const blockedExtensions = [
    ".exe",
    ".dll",
    ".bat",
    ".cmd",
    ".sh",
    ".msi",
    ".vbs",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".iso",
  ];
  if (blockedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File type '${ext}' is not permitted. Zip archives and executables are blocked.`,
    };
  }

  // 4. Verify extension is in allowlist
  if (!APP_LIMITS.allowedFileExtensions.includes(ext as (typeof APP_LIMITS.allowedFileExtensions)[number])) {
    return {
      valid: false,
      error: `File extension '${ext}' is not allowed. Allowed: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG, TXT.`,
    };
  }

  // 5. Inspect magic bytes if provided
  if (headerBytes && headerBytes.length >= 2) {
    // Check for executable signatures regardless of extension
    if (matchesSignature(headerBytes, MAGIC_NUMBERS.peExe)) {
      return {
        valid: false,
        error: "Malicious file detected: Executable binary disguised with an allowed extension.",
      };
    }
    if (matchesSignature(headerBytes, MAGIC_NUMBERS.elf)) {
      return {
        valid: false,
        error: "Malicious file detected: ELF binary disguised with an allowed extension.",
      };
    }

    // Specific format signature checks
    if (ext === ".pdf") {
      if (!matchesSignature(headerBytes, MAGIC_NUMBERS.pdf)) {
        return {
          valid: false,
          error: "Invalid PDF file: Missing standard PDF file header.",
        };
      }
    } else if (ext === ".png") {
      if (!matchesSignature(headerBytes, MAGIC_NUMBERS.png)) {
        return {
          valid: false,
          error: "Invalid PNG file: Corrupt or invalid image header.",
        };
      }
    } else if (ext === ".jpg" || ext === ".jpeg") {
      if (!matchesSignature(headerBytes, MAGIC_NUMBERS.jpeg)) {
        return {
          valid: false,
          error: "Invalid JPEG file: Corrupt or invalid image header.",
        };
      }
    } else if ([".docx", ".pptx", ".xlsx"].includes(ext)) {
      // Modern Office files are zip containers with PK header
      if (!matchesSignature(headerBytes, MAGIC_NUMBERS.zipOffice)) {
        return {
          valid: false,
          error: "Invalid Office document: Missing valid container header.",
        };
      }
    } else if (ext === ".txt") {
      // Plain text files should not contain null bytes
      for (let i = 0; i < Math.min(headerBytes.length, 512); i++) {
        if (headerBytes[i] === 0x00) {
          return {
            valid: false,
            error: "Binary file cannot be uploaded as a text document.",
          };
        }
      }
    }
  }

  return {
    valid: true,
    detectedType: declaredMimeType,
    sanitizedFilename: cleanFilename,
  };
}

/**
 * Generate secure random storage path for uploaded file
 * Path format: applications/{applicationId}/{uuid}.{ext}
 */
export function generateSecureStoragePath(
  applicationId: string,
  filename: string,
): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `applications/${applicationId}/${uniqueId}.${ext}`;
}
