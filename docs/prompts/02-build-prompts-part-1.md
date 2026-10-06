# Build prompts, part 1 (Prompts 1 to 11)

Run them in order, one at a time. Do not start a prompt until the previous one's acceptance criteria are verified. Each prompt is pasted into Antigravity (Planning mode). The spec is `docs/spec.md` and the rules are in `.agents/rules/`.

---

# Prompt 1: Repository, tooling and CI skeleton
## Goal
An empty but runnable project with linting, type checking, tests, secret scanning and CI, so everything later builds on verified tooling.
## Context
Empty repository. `docs/spec.md` and `.agents/rules/*.md` exist. Stack and invariants are in rules 00-project.
## Scope
In: project initialisation, tooling, config files, CI, docs skeleton, one placeholder home page. Out (do not touch): any feature code, database schema, auth, real UI.
## Requirements
1. Initialise Next.js (App Router, TypeScript strict, Tailwind) from the current official docs. Record every installed version in `docs/versions.md`.
2. Add ESLint, Prettier, Vitest, Playwright. Add npm scripts: `dev`, `lint`, `typecheck`, `test`, `test:rls` (placeholder), `test:e2e`, `build`, `audit`, `scan:secrets`.
3. Create `college.config.ts`: college name, email domain `rajlakshmi.edu.in`, student and staff email patterns, department map (empty with a TODO for the owner), `courseYears = 4`, `graduationMonthDay = "06-30"`, `academicYearStartMonth = 6`.
4. Create `src/config/limits.ts`: 20 @ai per user per day, 10 MB files, 3 open requests per lead, 10 pending mentor invites per staff, 30 messages per minute, allowed file types (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG, TXT).
5. Create `.env.example` with FAKE values for: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN`, `HF_PROVIDER`, `HF_MODEL`, `AI_ENABLED=false`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_RECIPIENT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `APP_ENV`, `DEMO_ALLOWED_EMAILS`. Real values go only in `.env.local` (gitignored).
6. gitleaks in a pre-commit hook and in CI.
7. A GitHub Actions workflow: install, lint, typecheck, unit tests, build, `npm audit` (fail on high), gitleaks.
8. README skeleton and `docs/` folders (`decisions/`).
## Security and privacy checklist
No secrets committed. Lockfile committed. `.env.local` ignored. CI fails if a secret is detected. Minimal dependencies.
## Method
Short plan, then proceed after planning. Small commits.
## Acceptance criteria
- `npm run dev` serves a placeholder page.
- Every script listed exists and exits successfully (`test:rls` may be a documented placeholder).
- `.env.example` contains no real-looking secret.
- A deliberately fake test secret is caught by gitleaks, then removed.
- The CI workflow file is valid and lists all steps.
## Verification
Run `npm run lint && npm run typecheck && npm test && npm run build && npm run scan:secrets` and paste the output.
## Report back
Files changed, tests added, command output as evidence, anything not verified, assumptions made.
## Stop and ask if
You need any dependency outside the stack, or any account or credential.

---

# Prompt 2: Architecture, data flows and threat model (planning only)
## Goal
A written architecture and threat model the owner approves BEFORE any feature code or schema exists.
## Context
Spec sections 3 to 8 and rules 00, 10, 30. Tooling from Prompt 1 exists.
## Scope
In: documents only. Out (do not touch): code, migrations, UI.
## Requirements
Create `docs/architecture.md` and `docs/threat-model.md` covering:
1. Modules and boundaries (auth, requests, applications, invites, rooms, chat, tasks, notifications, AI, moderation, lifecycle) and which spec feature each implements.
2. Data flow diagrams (Mermaid) for: sign-in, apply with a file, accept an invite (atomic count), room chat with realtime, @ai question and plan confirm, report and justification.
3. The RLS strategy: helper functions, which tables each role reads and writes, and how moderators and the owner are kept out of room data.
4. A list of Edge Functions and scheduled jobs (invite expiry, resume deletion at 30 days, graduation deactivation, justification deadline, @ai counter reset) with trigger and owner of each.
5. A threat model: assets, trust boundaries, and at least 25 abuse cases (for example filter bypass, ID guessing, malicious upload, prompt injection through a file, removed member still receiving realtime, moderator reading a room, service worker caching private data, invite double-accept race). Each has a mitigation or a named accepted risk.
6. Mapping table: spec feature to prompt number that builds it.
7. A short "questions for the owner" list if the spec is unclear.
## Security and privacy checklist
Every spec confidentiality statement has a matching technical control in the documents.
## Method
Read the spec fully, write the documents, then STOP and wait for the owner's approval.
## Acceptance criteria
Both files exist; every feature F1 to F16 maps to a prompt; every threat has a mitigation; open questions are listed (or "none").
## Verification
List the files and paste the mapping table and the threat count.
## Report back
Files created, any spec gaps found, assumptions you had to make.
## Stop and ask if
The spec conflicts with itself or with the rules.

---

# Prompt 3: Database schema, migrations and atomic functions
## Goal
The complete Postgres schema with constraints, migrations and the atomic functions that protect the key invariants.
## Context
Approved `docs/architecture.md` and spec section 5. Supabase CLI local development. RLS comes in Prompt 4, but create the tables with RLS enabled and NO policies yet (deny all).
## Scope
In: migrations, constraints, indexes, helper SQL functions, seed script for LOCAL development only, generated TypeScript types. Out: policies, UI, Edge Functions.
## Requirements
1. Tables from spec section 5, with foreign keys, enums for statuses, `created_at` and `updated_at`, and soft-delete fields where the spec needs them.
2. Constraint: a task's parent must itself have no parent (one level only), enforced in the database.
3. `accept_invite(application_id)`: one atomic function with a row lock on the request that checks the invite is selected and unexpired, remaining spots greater than 0, then marks accepted. The count is derived from accepted applications, never stored separately.
4. Functions for headcount changes (raise only), `close_request`, room creation from a request, and member add. All idempotent.
5. Indexes for the feed, inbox, messages by room and time, and tasks by room.
6. A seed script with synthetic users for local use only. It must refuse to run unless `APP_ENV=local`.
7. Generated TypeScript types committed.
## Security and privacy checklist
Least-privilege grants. No table readable by `anon`. Sensitive columns documented. No real data in seeds.
## Method
Plan and WAIT for approval, then implement in small migrations, with tests for each constraint.
## Acceptance criteria
- `supabase db reset` runs cleanly.
- A test proves a subtask cannot have a subtask.
- A concurrency test proves two simultaneous accepts for the last spot give exactly one success.
- A test proves the count cannot go above the headcount or below 0.
- The seed script refuses to run when `APP_ENV` is not `local`.
## Verification
`supabase db reset`, the SQL tests, `npm run typecheck`. Paste the output.
## Report back
Files changed, tests added, evidence, anything not verified, assumptions.
## Stop and ask if
Any spec entity is unclear or a migration would be destructive.

---

# Prompt 4: Row-Level Security policies and negative test suite
## Goal
Make the database itself enforce who can see and change what, and prove it with tests that try to break it.
## Context
Schema from Prompt 3. Business invariants 1 to 9 in rules 00. Threat model from Prompt 2.
## Scope
In: RLS policies, helper functions, storage policies, test suite. Out: UI, Edge Functions.
## Requirements
1. Helper functions such as `is_room_member`, `is_active_mentor`, `is_request_lead`, `can_view_request` (compares the viewer's year, department and gender with the request filters; an empty filter means no restriction; "Other" and "Prefer not to say" match only requests without a gender filter).
2. Policies for every table and storage bucket, deny by default, per role: student, staff, moderator, owner, applicant, lead, member, mentor.
3. Moderators read only reports and snapshots. The owner reads only role and audit-summary data. Neither has any policy on room tables.
4. Staff cannot read the requests feed.
5. Applicants cannot read other applicants' files. After a request closes, unselected applicants' files are readable by the lead only.
6. `audit_log` is insert-only for everyone except through security-definer functions; no updates or deletes.
7. Realtime authorization so only active members can subscribe to a room's events.
## Security and privacy checklist
No `using (true)` policies. Security-definer functions pin `search_path`. Service role used nowhere in the browser.
## Method
Plan and WAIT for approval, then implement table by table, writing the negative tests first.
## Acceptance criteria
Tests (run by `npm run test:rls`) demonstrate that: a non-member cannot read a room's messages, tasks, files; a removed member loses access; a non-matching student cannot see a filtered request; staff cannot read the feed; a moderator selecting from `messages` gets zero rows; an applicant cannot read another's files; a user cannot insert into `app_roles`; a mentor sees a room only after accepting; audit rows cannot be edited.
## Verification
`npm run test:rls`. Paste the full results.
## Report back
Files changed, test count, evidence, anything not verified, assumptions.
## Stop and ask if
A needed access rule is not in the spec.

---

# Prompt 5: Authentication, onboarding and profile
## Goal
College-only Google sign-in enforced on the server, with profile data derived from the email.
## Context
Spec F1, rules 10. `college.config.ts` holds the domain and patterns. The owner supplies Google OAuth credentials in `.env.local`/Supabase dashboard themselves.
## Scope
In: auth, the before-user-created hook, onboarding, profile page, route protection. Out: other features.
## Requirements
1. Supabase Auth with Google. Show the college domain hint on the Google screen, but NEVER rely on it.
2. A before-user-created Auth Hook that rejects any email outside the college domain or not matching the student or staff pattern (4 or 3 dot-separated segments before the domain). In non-production only, `DEMO_ALLOWED_EMAILS` may allow named test accounts.
3. A tested pure function `parseCollegeEmail(email)` returning kind, name, initial, year, department. Edge cases: capital letters, extra dots, plus-addressing (reject), digits in names, missing segments.
4. Onboarding: display name, gender (Female, Male, Other, Prefer not to say), privacy notice consent stored with version and time. Profile page: gender and display name editable; year, department and email read-only.
5. Blocked or deactivated accounts see an explanation and cannot use the app. Server-side route protection by middleware.
6. Roles read from `app_roles` only.
## Security and privacy checklist
Server-side domain check. Roles not in client metadata. Rate limits on auth paths. Secure cookies. No tokens in logs. Consent stored.
## Method
Plan, then proceed after planning. Small commits. Tests alongside.
## Acceptance criteria
- A non-college Google account is rejected and no user row exists (show evidence).
- A malformed college-looking email is rejected.
- `parseCollegeEmail` tests cover at least 15 cases and pass.
- A normal user cannot change their own role or year.
- Consent version and time are stored.
## Verification
`npm run lint && npm run typecheck && npm test && npm run test:rls && npm run test:e2e`. Paste output.
## Report back
Files changed, tests, evidence, anything not verified (for example the real Google flow, which needs the owner's credentials), assumptions.
## Stop and ask if
You need real credentials or the hook cannot be enabled on the current plan.

---

# Prompt 6: Design system, app shell and PWA
## Goal
An elegant, attractive, consistent interface foundation and an installable app shell, so every later screen looks professional.
## Context
Design direction in rules 00. Auth exists. No feature screens yet.
## Scope
In: tokens, components, layout, navigation, PWA manifest and service worker, install prompt. Out: feature screens.
## Requirements
1. Design tokens in one theme file: color (neutral base, one accent, success, warning, danger), typography (a refined pairing with proper fallbacks), spacing, radii, shadows, motion. Light and dark modes.
2. Components: Button, IconButton, Input, Textarea, Select, Checkbox, Chip, Badge, Card, Dialog, Sheet, Tabs, Toast, Avatar, Skeleton, EmptyState, ProgressBar. Accessible by default.
3. App shell: bottom navigation on phones (Requests, Rooms, Inbox with unread badge icon, Profile), a sidebar on desktop. A staff variant with the mentor inbox.
4. PWA: manifest, icons placeholder, service worker caching ONLY the static shell (never authenticated data), an offline fallback page, an install prompt with iOS "Add to Home Screen" instructions.
5. A dev-only `/design` page showing every component in both modes.
6. Subtle motion (150 to 250 ms), respecting `prefers-reduced-motion`. Friendly microcopy in empty states.
## Security and privacy checklist
Service worker never caches API responses, room content or files. Caches cleared on sign-out.
## Method
Plan, then proceed after planning.
## Acceptance criteria
- `/design` renders all components in light and dark.
- Playwright screenshots at 360, 768 and 1280 px are saved in `docs/screenshots/`.
- An automated accessibility check (axe) finds no serious violations on `/design`.
- The app passes the browser's installability check.
- A test proves the service worker does not cache an authenticated request.
## Verification
`npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`.
## Report back
Files changed, tests, evidence, anything not verified, assumptions.
## Stop and ask if
You want to add a UI library not in the stack.

---

# Prompt 7: Team requests and the filtered feed
## Goal
Leads can post and manage requests; students see only the requests they are eligible for.
## Context
Spec F2, invariants 1 and 10. Schema and RLS exist. Department codes come from `college.config.ts`.
## Scope
In: create, edit, close, feed, search, My requests list. Out: applications, invites.
## Requirements
1. Create-request form: title, description, project status, role needed, headcount (1 to a configured maximum), free-text skill tags (max 10, 30 characters each), filters (any mix of year, department, gender), "resume required" toggle. Year choices are 1st to 4th year, stored as admission-year batches at posting time.
2. The feed lists only requests the viewer may see, using the database policies. Search by title and tags. Pagination.
3. At most 3 open requests per lead, enforced on the server.
4. Edit while open; close manually.
5. Staff accounts do not see the feed.
6. Sanitize and length-limit all text.
## Security and privacy checklist
Eligibility enforced by RLS, not by the UI. Server-side validation. XSS-safe rendering. Rate limit on creation.
## Method
Plan, then proceed after planning.
## Acceptance criteria
- A student not matching a filter cannot see the request, even by direct URL (test).
- The 4th open request is rejected on the server.
- A script tag in a title renders as text.
- Staff receive an empty or forbidden result for the feed.
- Departments missing from config are handled gracefully.
## Verification
All scripts. Paste the output.
## Report back
Files changed, tests, evidence, anything not verified, assumptions.
## Stop and ask if
The department code list in `college.config.ts` is still empty (ask the owner for the list).

---

# Prompt 8: Applications and secure file uploads
## Goal
Students can apply with optional documents, and uploads are handled safely.
## Context
Spec F3, rules 10 (uploads), invariant 9.
## Scope
In: apply, withdraw, delete own files, upload pipeline, file download. Out: selection and invites.
## Requirements
1. Apply form with an optional note and files; required if the request says so.
2. Upload pipeline: allowlist by extension, declared type and file signature; 10 MB limit; random storage names; private bucket; short-lived signed URLs; forced download; a scanner interface with a documented no-op implementation and a note in `docs/security-report.md` that real antivirus scanning is added after approval.
3. One application per student per request; cannot apply to your own request; only eligible students can apply.
4. Withdraw an application and delete own files at any time, even after selection (hard delete from storage and database).
5. Visibility: applicant (own), lead, confirmed members; no other applicants.
## Security and privacy checklist
Server-side validation of type and size. Signed URLs expire. No inline rendering. Upload rate limit. Never send files to third-party services.
## Method
Plan, then proceed after planning.
## Acceptance criteria
- A zip file, an `.exe`, and an `.exe` renamed to `.pdf` are all rejected.
- An 11 MB file is rejected.
- Another applicant cannot download my file (test).
- After deletion, the storage object no longer exists (verified).
- A signed URL stops working after its expiry.
## Verification
All scripts. Paste the output.
## Report back
Files changed, tests, evidence, anything not verified, assumptions.
## Stop and ask if
The storage plan limit would block the 10 MB rule.

---

# Prompt 9: Selection, invites, waiting list and spots
## Goal
The lead can select applicants; selected people accept in the app; counts and expiries are always correct.
## Context
Spec F4, invariants 3, 4, 5. `accept_invite` exists from Prompt 3.
## Scope
In: lead console, select, reject, waitlist, invite expiry, accept and reject by the invitee, raise headcount, replace a member, expiry job. Out: room creation and notifications delivery (Prompts 10 and 11), but create the notification records.
## Requirements
1. Lead console lists applicants with notes and files.
2. Select creates an invite with an expiry the lead sets (presets 24h, 48h, 72h, 7 days, custom within sensible bounds).
3. The invitee accepts or rejects. Accepting calls `accept_invite`. If the team is already full the invitee sees a clear message.
4. The open-spot count drops only on acceptance.
5. At 0 spots the lead can raise the headcount or replace a member (removal with a reason).
6. The waiting list is lead-only and manual.
7. A scheduled job auto-rejects expired invites and creates a notification for the lead.
8. Every decision writes an audit entry.
## Security and privacy checklist
Only the lead can select. Only the invitee can answer their invite. Idempotent job. No data leaks between applicants.
## Method
Plan and WAIT for approval, then implement.
## Acceptance criteria
- Two simultaneous accepts for the last spot: exactly one succeeds (test).
- The count is unchanged when someone is only selected.
- An expired invite becomes rejected after the job runs (time-travel test) and the lead gets a notification record.
- A non-lead cannot select or waitlist.
- Waitlisted people are invisible to other applicants.
## Verification
All scripts. Paste the output.
## Report back
Files changed, tests, evidence, anything not verified, assumptions.
## Stop and ask if
The "replace a member" behavior needs a rule the spec does not give.

---

# Prompt 10: Closing, room formation, follow-up requests and file retention
## Goal
Requests close correctly, a room is created exactly once, follow-up requests add people to the same room, and old resumes are removed on time.
## Context
Spec F5 and decision D5, invariant 9.
## Scope
In: close and full handling, room creation, follow-up requests, retention job. Out: room features (Prompts 12 onward).
## Requirements
1. When a request becomes full or the lead closes it, create one room with the lead and accepted members. Pending invites stay valid until they expire. Someone who accepts after the close joins the existing room if the headcount allows.
2. A follow-up request linked to the room shows current members, extra people needed, project description, current status and the role. People accepted from it join the same room automatically. Existing members get an information notification.
3. At close, unselected applicants' files become lead-only and `delete_after = closed_at + 30 days`. A daily job hard-deletes expired files from storage and database.
4. If the lead raises the headcount on a full request, the request reopens and the same room is kept.
## Security and privacy checklist
Retention job is idempotent and logged (IDs only). Members lose access to unselected applicants' files at close.
## Method
Plan, then proceed after planning.
## Acceptance criteria
- Exactly one room exists per team (test).
- A follow-up request adds the accepted person to the existing room and creates notifications for others.
- A file is deleted 30 days after closing (time-travel test), and is still present at day 29.
- Closing early with fewer people than the headcount works.
## Verification
All scripts. Paste the output.
## Report back
Files changed, tests, evidence, anything not verified, assumptions.
## Stop and ask if
Behavior for an edge case is not covered by D5.

---

# Prompt 11: Inbox, email and push notifications
## Goal
Selection and mentor invites reach people by email; everything else reaches the inbox and push.
## Context
Spec F6, invariant 11, rules 10 (push payloads).
## Scope
In: inbox UI and realtime updates, email via Resend, web push, notification preferences. Out: new event types.
## Requirements
1. Inbox page with typed items: selection invite (accept, reject), outcome (selected or rejected for each team applied to), waitlist, mentor invite, lead swap, information. Unread badge. Mark as read. Realtime updates.
2. Email ONLY for selection invites and mentor invites. Sent from an Edge Function using Resend, with plain and HTML versions. Sender from `EMAIL_FROM`. When `APP_ENV` is not production, send ONLY to `EMAIL_TEST_RECIPIENT`.
3. Web Push with VAPID keys: subscribe and unsubscribe, a sender function, a short title and a deep link only. Explain the iPhone "Add to Home Screen" requirement in the UI.
4. Idempotency: the same event never sends two emails. Retries with backoff. Failures are logged and never block the main action.
## Security and privacy checklist
API keys server-side only. Push payload has no message text. Rate limits. Emails contain only what the recipient needs.
## Method
Plan, then proceed after planning.
## Acceptance criteria
- A selection creates an inbox item and an email to the test address (show the Resend log or a mock assertion).
- In a non-production environment, an email to any other address is blocked (test).
- A duplicate event does not send a second email (test).
- The unread badge updates in realtime.
- A push payload test shows no message content.
## Verification
All scripts. Paste the output.
## Report back
Files changed, tests, evidence, anything not verified (real email and push need the owner's keys), assumptions.
## Stop and ask if
You need real Resend or VAPID credentials.
