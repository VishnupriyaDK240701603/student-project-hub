# Security & Upload Validation Report

## 1. File Upload Security Pipeline (Prompt 8)

### Architecture & Defense in Depth
The application implements strict defense-in-depth protections for student document uploads:

1. **Declared & Magic Bytes Validation**:
   - The file upload pipeline (`src/lib/storage/upload-validation.ts`) inspects both declared MIME types, extension allowlists, and raw binary file signatures (magic bytes).
   - Executable formats (DOS/PE `MZ` headers, Linux `ELF` binaries, script files) are detected and **strictly blocked** even if renamed with an allowed extension (e.g. `malware.exe` renamed to `resume.pdf`).
   - Raw archive containers (e.g. `.zip`, `.rar`, `.7z`) are rejected unconditionally.
   - Allowed document formats: PDF (`%PDF-`), DOCX/PPTX/XLSX (Office OpenXML format), Images (PNG, JPEG), and TXT.

2. **File Size Enforcement**:
   - 10 MB maximum limit (`APP_LIMITS.maxFileSizeBytes = 10485760` bytes) is enforced:
     - Client-side pre-flight check in `ApplyModal.tsx`.
     - Server-side check in `submitApplication` action.
     - Database CHECK constraint on `application_files.file_size_bytes <= 10485760`.

3. **Storage Security & Access Isolation**:
   - Private Supabase storage bucket (`application-files`) with deny-all public access.
   - Storage paths are generated with cryptographic UUIDs (`applications/{application_id}/{uuid}.{ext}`), preventing path traversal, predictable ID guessing, and collision.
   - Files are served exclusively through short-lived signed URLs (300 seconds / 5 minutes expiry).
   - Signed download URLs force `Content-Disposition: attachment` to prevent inline execution of untrusted files in the browser.

4. **Hard Deletion & User Privacy (Invariant 9)**:
   - When an applicant withdraws their application or deletes their file, both the database row in `application_files` and the binary object in Supabase storage are hard-deleted immediately.

### Antivirus Scanning Status
- **Current Implementation**: A decoupled `FileScanner` interface (`src/lib/storage/upload-validation.ts`) with a documented `MockFileScanner` no-op implementation.
- **Production Integration Note**: Live antivirus scanning (e.g. ClamAV daemon via streaming container or third-party scanning engine) is planned for deployment after formal college administrative and infrastructure approval.
