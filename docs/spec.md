# Student Project Hub spec (version 1)

Status: approved by the owner, including all defaults in section 11 (confirmed 6 October 2026). Copy this file to `docs/spec.md` in the repository.

## 1. Summary
Student Project Hub is a private web app and installable phone app (PWA) for one college at a time, first Rajalakshmi (`rajlakshmi.edu.in`), for about 5,000 users. Only people with a college email can enter. A student posts a team formation request as team lead, optionally limited to certain years, departments or genders. Eligible students apply (resumes optional unless the lead requires them), the lead selects people, selected people accept in the app, and once the team is formed a private room opens with chat, files, a task board, deadlines, meetings, a progress dashboard and an @ai assistant. Staff act as mentors. Everything in a room is confidential to its members. It is a client project: the owner builds it and hands accounts, keys and documentation to college IT at the end. Each new college gets a separate customised deployment.

**Stack:** Next.js + TypeScript + Tailwind (web and PWA), Supabase (Postgres with Row-Level Security, Google sign-in, private file storage, Realtime, Edge Functions, scheduled jobs), Resend (email), Web Push, Hugging Face Inference (@ai). Demo on free tiers; low-cost plans after approval.

## 2. Users and roles
| Role | How identified | Can do | Cannot do |
|---|---|---|---|
| Student | Email `name.initial.year.dept@domain` | Browse eligible requests, apply, lead a team, join rooms, report, appeal | See requests they do not match; see other rooms |
| Staff (mentor) | Email `name.initial.dept@domain` | Receive and answer mentor invites; join rooms as mentor; view all progress in rooms they joined | Browse the requests feed; join as a team member |
| Moderator | Staff account with `moderator` in `app_roles` | Review reports and attached snapshots; request justification; dismiss; permanently block; review appeals filed against another moderator's block | Read any room; see anything beyond the report |
| Owner | `owner` in `app_roles` | Add or remove moderators; view the audit summary | Read any room |
| Team lead | Student who created a request or took over leadership | Everything about their request and room, including permissions for members | Add someone who never accepted |
| Applicant | Student with an application | Withdraw, delete own files | See other applicants' files |
Year and department come only from the email. Gender is chosen by the student and editable anytime.

## 3. Features (priority order)
**F1 Sign-in and profile.** Trigger: Google sign-in. Result: only valid college emails create an account; profile derived from the email; student picks gender and display name and accepts the privacy notice. Acceptance: non-college Google accounts are rejected on the server; invalid patterns rejected; consent stored with version and time; blocked or deactivated accounts see an explanation. Out of scope: passwords.

**F2 Team requests and filters.** Trigger: a student creates a request. Fields: title, description, project status, role needed, headcount, free-text skill tags, filters (any mix of year, department, gender), "resume required" toggle. Result: visible to all students if no filters; otherwise only to students matching every filter. Acceptance: non-matching students cannot see or fetch it; at most 3 open requests per lead; requests stay open until closed or full; staff cannot browse the feed. Year filters are chosen as 1st to 4th year and stored as batches at posting time.

**F3 Applications.** Trigger: an eligible student applies. Result: optional note and documents (required only if the lead says so). Acceptance: one application per student per request; cannot apply to own request; allowed types PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG, TXT, up to 10 MB; applicants can withdraw and delete their files anytime, even after selection; other applicants never see their files.

**F4 Selection, invites and waiting list.** Trigger: the lead reviews applicants. Result: select, reject or waitlist. A selected person gets an email and an inbox invite with an expiry set by the lead, and accepts or rejects in the inbox. Acceptance: the open-spot count drops only on acceptance, atomically; invites auto-reject on expiry and the lead is told; the waiting list is lead-only and manual; at 0 spots the lead can raise the headcount or replace a member.

**F5 Closing, room creation and follow-up requests.** Result: the lead can close early. The room is created when the request becomes full or is closed, with the lead and accepted members. A later follow-up request shows the current members, extra people needed, project description, status and role; people accepted from it join the existing room automatically and everyone is notified. Acceptance: exactly one room per team; resumes of unselected applicants become lead-only on close and are hard-deleted 30 days after.

**F6 Inbox and notifications.** Two separate areas: the requests feed and the inbox (selection invites with accept/reject, outcomes for teams applied to, waitlist updates, mentor invites, lead swaps, information). Email only for selection and mentor invites. Everything else uses inbox and push. Push on iPhones works only after the app is added to the Home Screen (iOS 16.4+), so the inbox is the fallback.

**F7 Rooms, permissions, lead swap and removal.** A student can be in many rooms; each is visible only to its members. The lead sets per-member permissions: edit the task board, set deadlines and milestones, invite a mentor or re-add members. All members can always chat, use @ai and upload. Lead swap: the lead offers to a teammate who accepts, or a teammate asks and the lead approves; the request, applicants and waitlist move to the new lead. Removal needs a written reason visible to all members; removed members lose access, their messages and files stay. "Delete room" means leaving; the lead can re-add only someone who had accepted.

**F8 Chat and files.** Realtime chat with text, attachments, replies, edit and delete of own messages, emoji reactions and @mentions of teammates. File sharing; files can be deleted only by the uploader or the lead. Not in v1: private one-to-one messages.

**F9 Task board.** A mini project-management board: tasks with one level of subtasks, each with assignees, status (To do, In progress, Done), due date, description, comments and attachments. Needs the "edit task board" permission to create, edit, delete.

**F10 Deadlines, milestones and meetings.** Milestones and deadlines (needs the "set deadlines" permission); meeting scheduling with a link.

**F11 Progress dashboard.** Separate dashboard driven by the task board. Everyone in the room sees team-level progress; each member sees their own; the lead and mentor see every member's.

**F12 Mentors.** The lead (or a member with permission) invites any staff member. The staff member accepts or rejects from a console with an inbox icon and badge. The inviter sets the expiry and the invite auto-rejects after it. A staff member can have at most 10 pending invites. An accepted mentor joins the room as a non-member role with chat access.

**F13 @ai.** See section 6.

**F14 Moderation.** Any user can report a user or request, attaching specific messages themselves (stored as snapshots). Moderators (designated staff, at least two) see only the report and snapshots. Flow: review, ask the accused for a justification with a deadline the moderator sets, then dismiss or permanently block. A blocked person can appeal; a different moderator than the one who blocked them decides.

**F15 Account lifecycle.** Student accounts deactivate automatically after the batch's expected graduation (joining year + 4, configurable per college). A moderator deactivates staff who leave.

**F16 Privacy, limits, audit.** Privacy notice and consent; usage limits (20 @ai per user per day, 10 MB files, 3 open requests per lead, 10 pending mentor invites per staff); an audit log of sensitive actions with no message or file content.

## 4. Screens and flows
Sign-in; onboarding (gender, display name, consent); requests feed with filters and search; request detail and apply; create request; My requests (lead console: applicants, select, reject, waitlist, expiry, close, follow-up request); inbox; rooms list; room with tabs (Chat, Tasks, Files, Deadlines, Meetings, Dashboard, Members); profile and settings; staff console (mentor invites); moderator console (reports, appeals); owner page (moderators, audit summary).
Main flow: sign in, browse, apply, receive invite, accept in the inbox, enter the room. Lead flow: post, review, select, close, work in the room, swap leadership if needed.

## 5. Data model (high level)
Sensitivity: P = public to signed-in users, I = internal, PD = personal, S = sensitive.
- `profiles` (PD): id, email, display name, kind (student/staff), admission year, department, gender (S), blocked, deactivated, consent version.
- `app_roles` (I): user, role (owner/moderator). Not writable by users.
- `team_requests` (I): lead, title, description, status, role needed, headcount, tags, filters (years, departments, genders), resume required, optional room link, closed time.
- `applications` (S): request, applicant, note, status (applied, selected, waitlisted, rejected, accepted, declined, expired, withdrawn), invite expiry; `application_files` (S): storage path, type, size, delete-after time.
- `rooms` (S): lead; `room_members` (S): room, user, role (lead, member, mentor), status (active, left, removed), permission flags; `room_events` (I): swaps, removals with reasons, joins.
- `mentor_invites` (I), `lead_transfers` (I).
- `messages`, `reactions`, `mentions` (S); `room_files` (S); `tasks` with one-level parent, `task_assignees`, `task_comments`, `task_attachments`, `milestones`, `meetings` (S).
- `notifications` (PD), `push_subscriptions` (PD).
- `reports`, `report_snapshots`, `justifications`, `appeals` (S).
- `audit_log` (I): actor, action, target, metadata without content; insert-only.
- `ai_usage` (I): user, day, count.

## 6. AI behavior
Purpose: help a room's members. Trigger: `@ai` plus a question in the room chat; reply visible to everyone in the room. Allowed data: only that room's recent messages, tasks, milestones, meetings and text from that room's files. Allowed action: propose a task plan, shown first; created only after confirmation by someone with task-board permission. Forbidden: reading other rooms, applications, resumes, reports or personal data; deleting or changing anything else; sending email; calling external URLs. Fallback: a plain "could not answer" message. Limits: 20 questions per user per day. Provider: Hugging Face Inference (server side), model and provider set by configuration, real data allowed only after the owner approves the provider decision record; until then @ai is switched off.

## 7. Integrations
Google sign-in (the owner's own Google Cloud project for the demo; the college creates its own later). Supabase. Resend (demo: sends only to the owner's test address; after approval: a college-provided `noreply@rajlakshmi.edu.in`). Web Push (VAPID). Hugging Face Inference. A hosting provider chosen at staging time after checking its free-plan terms for client work.

## 8. Non-functional requirements
Security: row-level security everywhere, server-side validation, rate limits, security headers, private storage, no admin or developer screen that can open a room. Privacy: encrypted storage, minimal logging, privacy notice and consent. Availability: a target of 99% during the pilot, health check, backups with a tested restore (after the move to a paid plan). Performance: main screens load in under 3 seconds on a mid-range phone on 4G; chat messages appear in under 1 second. Accessibility: WCAG AA basics, keyboard use, reduced motion. Devices: current Chrome, Edge, Firefox, Safari and Android Chrome; iOS 16.4+ for push. Design: elegant, attractive, light and dark modes, English only, themed from one file.

## 9. Compliance and legal notes
Applies: India's Digital Personal Data Protection Act, 2023. Needs a lawyer or the college's legal contact: consent wording, handling of users under 18 (if any), retention periods, account deletion requests (not automated in v1), and treating the AI provider as a data processor. The privacy notice must say that @ai sends room content to a third-party model provider. This spec does not claim legal compliance.

## 10. Out of scope for version 1
Private one-to-one messages; archiving rooms; browsing past teams or projects; data export for students; end-to-end encryption; per-student graduation date overrides; real antivirus scanning of uploads (a scanner interface and strict validation are built; real scanning is added after approval); multi-college shared system.

## 11. Decisions
**Open questions:** none.

**Defaults (all accepted by the owner):**
- D1 Moderators are added and removed on an owner-only page (`/owner`), by email, and must be staff accounts. At least two moderators are required for appeals to work.
- D2 No private one-to-one messages in version 1.
- D3 UI: elegant and attractive, English only, light and dark mode, calm neutral palette with one accent set in a single theme file, so college colors can be applied later.
- D4 Gender choices: Female, Male, Other, Prefer not to say. A gender filter of "female" or "male" shows the request only to those students.
- D5 A room is created when the request becomes full or the lead closes it, with the lead and accepted members. Invites still pending when a request closes stay valid until they expire. Anyone who accepts after the close joins the existing room if the headcount allows.
- D6 Outside production, a list of named test emails (`DEMO_ALLOWED_EMAILS`) may sign in so you can test; this does not exist in production.
- D7 Members without the "edit task board" permission can view and comment, and can change the status of tasks assigned to them. Any member can add meetings; only the creator or the lead can delete them.
- D8 Student accounts deactivate on 30 June of (joining year + 4); the date and the 4 years are configuration values.
