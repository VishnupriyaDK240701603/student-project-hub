# Security and Institutional Privacy Report

**Student Project Hub**
**Version**: 1.0 (Hardened)
**Date**: October 2026
**Target Architecture**: Next.js 15, Supabase PostgreSQL with RLS, Hugging Face AI Integration

---

## 1. Executive Summary & Architecture Segregation
Student Project Hub enforces strict defense-in-depth isolation across student rooms, faculty mentorship, staff moderation, and institutional ownership.

- **Invariant D1 (Moderator & Owner Isolation)**: Staff moderators and system owners have zero database SELECT permissions or query mechanisms on private room tables (`rooms`, `room_members`, `messages`, `tasks`, `room_files`). Report handling operates exclusively on immutable snapshot captures.
- **Two-Moderator Appeal Requirement**: Decisions on appeals for blocked users must be made by a different moderator than the one who actioned the initial block. The system enforces at least 2 active moderators at all times.
- **Audit Logging Immutability**: All sensitive administrative actions (reports, justifications, blocks, appeals, moderator assignments, lifecycle deactivations) write immutable records containing IDs and metadata only (no message or file content).

---

## 2. Security Hardening & Edge Function Authorization Review

All server actions and API handlers enforce explicit authorization before accessing data or invoking database routines:

| Server Action / Endpoint | Authorization Enforcement | Negative Test File |
| :--- | :--- | :--- |
| `createReportAction` | `auth.uid()` required + Rate limit (5/day) | `src/server/actions/moderation.test.ts` |
| `getModerationQueueAction` | `app_roles.role == 'moderator'` required | `src/server/actions/moderation.test.ts` |
| `blockUserAction` | `app_roles.role == 'moderator'` required | `src/server/actions/moderation.test.ts` |
| `resolveAppealAction` | `role == 'moderator'` AND `decider_id != blocker_id` | `src/server/actions/moderation.test.ts` |
| `getOwnerDataAction` | `app_roles.role == 'owner'` required | `src/server/actions/owner.test.ts` |
| `addModeratorAction` | `app_roles.role == 'owner'` + target `kind == 'staff'` | `src/server/actions/owner.test.ts` |
| `removeModeratorAction` | `app_roles.role == 'owner'` + `modCount > 2` | `src/server/actions/owner.test.ts` |
| `createTaskAction` | `is_room_member` AND (`is_lead` OR `can_edit_tasks`) | `src/server/actions/permissions-negative.test.ts` |
| `createMilestoneAction` | `is_room_member` AND (`is_lead` OR `can_set_deadlines`) | `src/server/actions/permissions-negative.test.ts` |
| `sendMentorInviteAction` | `is_lead` OR `can_invite_mentors` + `pendingCount < 10` | `src/server/actions/mentors.test.ts` |
| `handleAiQueryAction` | `is_room_member` + bounded context sanitization | `src/server/actions/ai.test.ts` |

---

## 3. Security Headers Configuration

The application enforces the following HTTP security headers via `next.config.ts`:
- **Content-Security-Policy (CSP)**: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';`
- **Strict-Transport-Security (HSTS)**: `max-age=63072000; includeSubDomains; preload`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=(), payment=()`

---

## 4. Legal & Regulatory Compliance Checklist (DPDP Act 2023)

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

## 5. Security Scanner Findings & Accepted Risks

- **npm audit**: 0 vulnerabilities.
- **Gitleaks / Secret Scanning**: 0 exposed credentials in git repository.
- **Accepted Risk - Antivirus Upload Scanning**: In v1, file upload validation strictly inspects size limits (10MB), magic bytes (PDF, JPEG, PNG, Office ZIP containers), and blocks executables/scripts. Real-time antivirus scanning is implemented as a documented interface `MockFileScanner` intended for integration with the college's perimeter ICAP/ClamAV gateway upon deployment.
- **Human Security Review**: Scheduled with College IT prior to ingesting live student data.
