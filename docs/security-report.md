# Security and Institutional Privacy Report

**Student Project Hub**
**Version**: 1.0
**Date**: October 2026
**Target Architecture**: Next.js 15, Supabase PostgreSQL with RLS, Hugging Face AI Integration

---

## 1. Executive Summary & Architecture Segregation
Student Project Hub enforces strict defense-in-depth isolation across student rooms, faculty mentorship, staff moderation, and institutional ownership.

- **Invariant D1 (Moderator & Owner Isolation)**: Staff moderators and system owners have zero database SELECT permissions or query mechanisms on private room tables (`rooms`, `room_members`, `messages`, `tasks`, `room_files`). Report handling operates exclusively on immutable snapshot captures.
- **Two-Moderator Appeal Requirement**: Decisions on appeals for blocked users must be made by a different moderator than the one who actioned the initial block. The system enforces at least 2 active moderators at all times.
- **Audit Logging Immutability**: All sensitive administrative actions (reports, justifications, blocks, appeals, moderator assignments, lifecycle deactivations) write immutable records containing IDs and metadata only (no message or file content).

---

## 2. Legal & Regulatory Compliance Checklist (DPDP Act 2023)

### A. Digital Personal Data Protection Act Compliance
- [x] **Notice & Consent**: Versioned consent (`v1.0`) recorded upon onboarding and before sensitive actions (e.g. attaching resumes). Clear notice published at `/privacy`.
- [x] **Purpose Limitation**: Data collected for team formation, collaboration, and mentorship is strictly bounded to the designated project room.
- [x] **Data Minimization in AI**: The `@ai` assistant receives only bounded, sanitized room context (recent 50 messages, tasks, milestones). Personal identifiable information (PII, emails, phone numbers, resumes, cross-room data) is stripped.
- [x] **Storage Limitation**:
  - Unselected applicant data (resumes and notes) automatically purged after 30 days.
  - Student accounts automatically deactivated on 30 June of `admission_year + courseYears` (4-year graduation cycle).

### B. Users Under 18 Years of Age
- [x] **Institutional Enrolment Verification**: User registration is restricted to verified institutional email domains (`@rajlakshmi.edu.in`).
- [x] **Tracking & Behavioral Profiling Prohibited**: No targeted advertising, tracking pixels, or cross-site profiling is implemented.

### C. Grievance Redressal & Right to Appeal
- [x] **Confidential Moderation Queue**: Dedicated staff moderator console at `/staff/moderator-console`.
- [x] **Two-Tier Appeal System**: Blocked users can file appeals reviewed by an independent second moderator.

---

## 3. Central System Limits Verification

| Resource / Action | System Limit | Server Enforcement Location |
| :--- | :--- | :--- |
| **@ai Queries** | Max 20 queries / user / day | `src/server/actions/ai.ts`, `ai_usage` table |
| **File Upload Size** | Max 10 MB (10,485,760 bytes) | `src/lib/storage/upload-validation.ts`, `src/config/limits.ts` |
| **File Formats** | PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG, JPEG, TXT | `src/config/limits.ts`, storage upload validation |
| **Open Team Requests** | Max 3 active requests per lead | `src/server/actions/requests.ts`, `app_limits` |
| **Pending Mentor Invites** | Max 10 pending invites per staff member | `src/lib/mentor-validation.ts`, `src/server/actions/mentors.ts` |
| **Chat Message Rate Limit** | Max 30 messages / minute / user | `src/server/actions/chat.ts`, rate limiter |
| **Moderation Reports** | Max 5 reports / user / 24 hours | `src/lib/moderation-validation.ts`, `src/server/actions/moderation.ts` |
| **Justification Response Window** | 24 hours to 168 hours (7 days) | `src/lib/moderation-validation.ts`, `src/server/actions/moderation.ts` |
| **Active Staff Moderators** | Minimum 2 active moderators | `src/server/actions/owner.ts`, `removeModeratorAction` |

---

## 4. Verification & Testing Sign-Off

- **Vitest Test Suite**: 21 test files, 263+ automated test cases passing.
- **Zero Content in Audit Logs**: Verified by automated assertions in `src/server/actions/moderation.test.ts` and `src/server/actions/owner.test.ts`.
- **Graduation Time-Travel Validation**: Verified in `src/lib/lifecycle/graduation.test.ts`.
