# Project rules: Student Project Hub (always apply)

## What we are building
A private web app and installable PWA (phone app from the browser) for ONE college at a time (first college: Rajalakshmi). Students form project teams, then work in private rooms with chat, files, a task board, a progress dashboard and an @ai assistant. About 5,000 users. Staff act as mentors. The full spec is `docs/spec.md` and is the source of truth. If code and spec disagree, or the spec is silent on something that changes behavior, STOP and ask the owner. Never guess.

## Stack (use the latest stable versions, record them in `docs/versions.md`, read current official docs, never rely on memory for APIs)
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS. PWA: manifest + service worker.
- Supabase: Postgres with Row-Level Security (RLS), Auth (Google), private Storage buckets, Realtime, Edge Functions, scheduled jobs.
- Resend for email (server side only). Web Push with VAPID keys. Hugging Face Inference for @ai (server side only).
- Tests: Vitest (unit), Playwright (end to end), SQL tests for RLS. Lint and format: ESLint, Prettier. Secret scanning: gitleaks.
- One deployment per college. Every college-specific value lives in `college.config.ts`. Every limit lives in `src/config/limits.ts`. Never hard-code either elsewhere.

## Folder structure
- `src/app/` routes (App Router). `src/components/` UI. `src/components/ui/` design-system parts. `src/lib/` helpers. `src/config/` limits and theme. `src/server/` server-only code.
- `supabase/migrations/` SQL migrations. `supabase/functions/` Edge Functions. `supabase/tests/` RLS and SQL tests.
- `docs/` spec, architecture, threat model, decisions, runbook. `e2e/` Playwright tests.
- Naming: files kebab-case, React components PascalCase, SQL tables and columns snake_case, env vars UPPER_SNAKE.

## Business invariants (never break these; tests must prove them)
1. Email pattern: student `name.initial.year.dept@<domain>`, staff `name.initial.dept@<domain>`. Year and department come ONLY from the email and are never user-editable. Gender is chosen by the student and editable anytime.
2. Roles (`owner`, `moderator`) live in an `app_roles` table that users cannot write. Never trust roles from client-editable metadata.
3. A request's open-spot count drops ONLY when a selected person accepts, through one atomic database function with a row lock. It can never go below 0 or above the headcount.
4. Selection invites and mentor invites auto-reject after the expiry set by the inviter. Lead-swap requests never expire.
5. The waiting list is lead-only. Promotion from it is manual.
6. Room data (chat, files, tasks, dashboard) is readable only by active room members and an accepted mentor. Moderators, the owner, college admins and developers have NO read access and NO screen that can open a room.
7. Tasks have one level of subtasks only.
8. Removing a member requires a written reason visible to all room members. "Deleting a room" means leaving it for that member only. The lead can re-add only someone who previously accepted.
9. Resumes and documents: visible to the lead and confirmed members of that team. After a request closes, unselected applicants' files are visible to the lead only, and are hard-deleted 30 days after closing. Applicants can withdraw and delete their own files at any time.
10. Limits (from `src/config/limits.ts`): 20 @ai questions per user per day, 10 MB per file, 3 open requests per lead, 10 pending mentor invites per staff member. Allowed file types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG, TXT. Zip and executables are blocked.
11. Email is sent ONLY for team selection invites and mentor invites. Everything else uses the in-app inbox and push notifications. Outside production, email goes only to `EMAIL_TEST_RECIPIENT`.
12. Not in version 1: private one-to-one messages, room archiving, browsing past teams, data export, end-to-end encryption.

## Commands (create these npm scripts)
`dev`, `lint`, `typecheck`, `test`, `test:rls`, `test:e2e`, `build`, `audit`, `scan:secrets`. A change is not done until all pass.

## Design direction (applies to every screen)
Elegant, calm, modern and attractive: generous spacing, rounded cards, one accent color, refined typography, subtle motion (150 to 250 ms, honoring reduced-motion), light and dark modes, friendly empty states, mobile-first. All colors, fonts and spacing come from design tokens in one theme file so a new college can re-theme quickly. English only.
