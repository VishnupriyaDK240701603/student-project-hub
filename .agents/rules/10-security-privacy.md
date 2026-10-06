# Security and privacy rules (always apply)

No app can be guaranteed free of vulnerabilities. Your job is to layer defenses, run real scanners, and say plainly what you could not verify.

## Secrets
- Secrets live only in environment variables (`.env.local`, hosting secret store). Never in code, git history, logs, chat, screenshots or the browser bundle.
- Browser-safe values only: the Supabase URL and anon key (designed to be public, safe only because RLS is on). The service-role key, Resend key, Hugging Face token and VAPID private key are SERVER ONLY (Edge Functions or server code).
- `.env.example` has fake values only. gitleaks runs in pre-commit and CI. Never ask the owner to paste real keys into chat.

## Authentication and roles
- Use Supabase Auth with Google. The domain hint on the Google screen is only a convenience. ENFORCE the college domain and the student/staff email patterns on the server with a before-user-created Auth Hook. Reject everything else.
- Outside production only, `DEMO_ALLOWED_EMAILS` may allow named test accounts. This variable must not exist in production.
- Roles come from the `app_roles` table, never from client-editable metadata. Blocked or deactivated accounts are refused on every request.
- Sessions use the library defaults for secure cookies, expiry and refresh. Sign-out revokes the session.

## Authorization (deny by default)
- RLS is ON for every table, with no policy meaning no access. Every policy is covered by a negative test (a user who must NOT see or change the row tries and fails).
- Check access to the specific record, not just that the user is logged in (changing an ID in a URL must never reveal someone else's data).
- Moderators see only reports and the message snapshots attached to them. The owner page manages moderators and the audit summary. Neither can read rooms. No SQL view, function or API may bypass this.
- The service-role key bypasses RLS. Use it only in Edge Functions, only after an explicit authorization check in code, and keep those functions small.
- Realtime channels for rooms are private and authorized. A removed member must stop receiving events immediately.

## Input, output and uploads
- Validate every input on the server with a schema (for example zod): types, lengths, allowed values. Use parameterized queries or the Supabase client only. Never build SQL from strings.
- Render user text as text. Never insert raw HTML. If markdown is supported, sanitize it. Add a Content-Security-Policy.
- Uploads: allowlist by extension AND declared type AND file signature (magic bytes), 10 MB maximum, random storage names, private buckets, short-lived signed URLs, `Content-Disposition: attachment`, never served inline from the app origin. Zip and executables blocked. A scanner interface exists; until a real antivirus is wired in after approval, document that gap in `docs/security-report.md`. Never send user files to third-party scanning services.

## Abuse protection
- Rate limit every mutating endpoint and sign-in related path. Enforce limits on the server using `src/config/limits.ts`. Messages: 30 per minute per user.
- Set security headers: CSP, HSTS, X-Content-Type-Options, frame-ancestors none, Referrer-Policy, Permissions-Policy. CORS limited to known origins.

## Privacy and confidentiality
- Collect the minimum. Field sensitivity: public, internal, personal (name, email, year, department), sensitive (gender, resumes, room content, reports). Encrypted at rest through the platform, HTTPS everywhere.
- The service worker must NEVER cache authenticated API responses, room content or files. Cache only the static app shell. Clear caches on sign-out.
- Push payloads carry a short title only and a deep link, never message text or personal details.
- Logs never contain message text, file contents, tokens, emails of third parties or other personal data. Log IDs and event types.
- The audit log records who did what and when for removals, lead swaps, permission changes, profile edits, blocks, unblocks, moderator changes, and report decisions. It is insert-only and never stores message or file content.
- Privacy notice and consent: shown at first login (versioned, timestamped) and again where a resume is attached. It must state who can see the data, retention (30 days after closing for unselected applicants), and that @ai sends room content to a third-party model provider.
- Flag anything that needs a lawyer (India's DPDP Act, users under 18, retention, account deletion) in `docs/security-report.md`. Do not decide legal questions yourself.

## Dependencies
- Lockfile committed, minimal dependencies, `npm audit` and a static analyzer (Semgrep or CodeQL) in CI. No high or critical finding may be open at release unless the owner accepts it in writing.

## Errors
- Users see generic messages. Details go to logs. Never expose stack traces, SQL or keys.
