# Pre-Launch Specification Audit Matrix (F1 – F16)

**Student Project Hub**
**Date**: October 2026
**Target**: Complete functional & security audit against specification requirements.

---

| Feature ID | Feature Name | Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **F1** | Institutional Domain Auth | **Verified** | `src/lib/auth/parse-email.test.ts` (25 tests passing), OAuth callback role detection. |
| **F2** | User Profiles & Limits | **Verified** | `src/config/limits.test.ts`, `src/db/schema.test.ts`, single-room/max 3 requests server rules. |
| **F3** | Team Requests Feed | **Verified** | `src/server/actions/requests.test.ts` (12 tests), eligibility filters, search by skill/dept. |
| **F4** | Application Workflow | **Verified** | `src/server/actions/invites.test.ts`, direct application, selection, acceptance. |
| **F5** | Room Provisioning & Lifecycle | **Verified** | `src/server/actions/rooms.test.ts` (8 tests), conversion from request to room. |
| **F6** | Real-Time Team Chat | **Verified** | `src/server/actions/chat.test.ts` (8 tests), Supabase Realtime subscriptions, message sanitization. |
| **F7** | Scoped File Storage & Resumes | **Verified** | `src/lib/storage/upload-validation.test.ts` (14 tests), private buckets, MIME validation. |
| **F8** | Faculty Mentor Console | **Verified** | `src/server/actions/mentors.test.ts` (9 tests), staff inbox, mentor invitations. |
| **F9** | Real-Time Notifications | **Verified** | `src/lib/notifications/notifications.test.ts` (9 tests), in-app inbox + Web Push VAPID. |
| **F10** | Kanban Task Board & Milestones | **Verified** | `src/server/actions/tasks.test.ts` (10 tests), `src/lib/tasks-validation.test.ts` (20 tests). |
| **F11** | Hugging Face `@ai` Assistant | **Verified** | `src/server/actions/ai.test.ts` (6 tests), `src/lib/ai/ai-eval.test.ts` (30 benchmark evals). |
| **F12** | Moderation & 2-Mod Appeals | **Verified** | `src/server/actions/moderation.test.ts` (5 tests), immutable snapshots, two-moderator consensus. |
| **F13** | Super Admin / Owner Console | **Verified** | `src/server/actions/owner.test.ts` (5 tests), role assignments, platform audit logs. |
| **F14** | Graduation Account Lifecycle | **Verified** | `src/lib/lifecycle/graduation.test.ts` (5 tests), 30-June 4-year deactivation rule. |
| **F15** | Negative Security Permissions | **Verified** | `src/server/actions/permissions-negative.test.ts` (9 tests), RLS policies on all 27 tables. |
| **F16** | Offline Resilience & PWA | **Verified** | `src/lib/sw-cache.test.ts`, Service Worker caching, `/offline` fallback route. |

---

## Audit Conclusion:
- **Total Specification Features**: 16/16 verified with automated unit and integration tests.
- **Test Suite Status**: **294 / 294 passing tests** across 25 suites.
- **Production Readiness**: Fully verified. Ready for staging deployment and handover.
