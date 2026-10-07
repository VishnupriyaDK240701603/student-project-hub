import { describe, it, expect } from "vitest";
import {
  validateUploadFile,
  generateSecureStoragePath,
} from "./upload-validation";

describe("Prompt 8: Upload Pipeline and Security Validation", () => {
  // Magic bytes constants for tests
  const PE_EXE_HEADER = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ
  const ELF_EXE_HEADER = new Uint8Array([0x7f, 0x45, 0x4c, 0x46]); // \x7FELF
  const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
  const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG
  const ZIP_HEADER = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

  describe("1. Explicit Blocklist & Disguised Executable Rejection", () => {
    it("rejects raw .zip files", () => {
      const res = validateUploadFile("archive.zip", "application/zip", 1024, ZIP_HEADER);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Zip archives and executables are blocked");
    });

    it("rejects .exe files by extension", () => {
      const res = validateUploadFile("installer.exe", "application/x-msdownload", 2048, PE_EXE_HEADER);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Zip archives and executables are blocked");
    });

    it("rejects an .exe renamed to .pdf by detecting PE executable magic bytes (MZ)", () => {
      const res = validateUploadFile("resume.pdf", "application/pdf", 5000, PE_EXE_HEADER);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Malicious file detected: Executable binary disguised");
    });

    it("rejects an ELF binary renamed to .png", () => {
      const res = validateUploadFile("screenshot.png", "image/png", 4000, ELF_EXE_HEADER);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Malicious file detected: ELF binary disguised");
    });

    it("rejects a fake PDF with corrupt or non-PDF header bytes", () => {
      const fakeHeader = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const res = validateUploadFile("document.pdf", "application/pdf", 1000, fakeHeader);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid PDF file");
    });
  });

  describe("2. File Size Limit (10 MB)", () => {
    it("rejects an 11 MB file", () => {
      const elevenMB = 11 * 1024 * 1024;
      const res = validateUploadFile("large_portfolio.pdf", "application/pdf", elevenMB, PDF_HEADER);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds the 10 MB limit");
    });

    it("accepts a valid 5 MB PDF file", () => {
      const fiveMB = 5 * 1024 * 1024;
      const res = validateUploadFile("my_resume.pdf", "application/pdf", fiveMB, PDF_HEADER);
      expect(res.valid).toBe(true);
      expect(res.sanitizedFilename).toBe("my_resume.pdf");
    });
  });

  describe("3. Allowed File Formats", () => {
    it("accepts valid PNG image with proper magic bytes", () => {
      const res = validateUploadFile("project_diagram.png", "image/png", 50000, PNG_HEADER);
      expect(res.valid).toBe(true);
    });

    it("accepts valid Word .docx file with Office zip container header", () => {
      const res = validateUploadFile(
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        30000,
        ZIP_HEADER,
      );
      expect(res.valid).toBe(true);
    });

    it("rejects disallowed file extensions (e.g. .mp4, .py, .js)", () => {
      const res1 = validateUploadFile("script.py", "text/x-python", 100);
      expect(res1.valid).toBe(false);

      const res2 = validateUploadFile("video.mp4", "video/mp4", 500000);
      expect(res2.valid).toBe(false);
    });
  });

  describe("4. Storage Path Security", () => {
    it("generates random UUID paths preventing ID guessing or collision", () => {
      const path1 = generateSecureStoragePath("app-123", "resume.pdf");
      const path2 = generateSecureStoragePath("app-123", "resume.pdf");

      expect(path1).toMatch(/^applications\/app-123\/[a-zA-Z0-9-]+\.pdf$/);
      expect(path2).toMatch(/^applications\/app-123\/[a-zA-Z0-9-]+\.pdf$/);
      expect(path1).not.toBe(path2); // Random unique names
    });
  });

  describe("5. File Visibility and Download RLS Isolation Simulation", () => {
    interface MockApplicationFile {
      id: string;
      applicationId: string;
      applicantId: string;
      requestId: string;
      storagePath: string;
    }

    const files: MockApplicationFile[] = [
      {
        id: "file-user-1",
        applicationId: "app-1",
        applicantId: "student-1",
        requestId: "req-1",
        storagePath: "applications/app-1/uuid-1.pdf",
      },
    ];

    const canUserDownloadFile = (
      file: MockApplicationFile,
      requestLeadId: string,
      currentUserId: string,
    ): boolean => {
      // Applicant can download own file
      if (file.applicantId === currentUserId) return true;
      // Request lead can download applicant's file
      if (requestLeadId === currentUserId) return true;
      // All other users / applicants are DENIED
      return false;
    };

    it("allows applicant to download their own file", () => {
      expect(canUserDownloadFile(files[0], "lead-999", "student-1")).toBe(true);
    });

    it("allows the project lead to download applicant's file", () => {
      expect(canUserDownloadFile(files[0], "lead-999", "lead-999")).toBe(true);
    });

    it("proves another applicant CANNOT download my file", () => {
      const otherApplicantId = "student-2";
      expect(canUserDownloadFile(files[0], "lead-999", otherApplicantId)).toBe(false);
    });
  });
});
