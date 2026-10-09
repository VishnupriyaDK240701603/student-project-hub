# Production Release Checklist

**Target**: Student Project Hub — Production Launch Verification
**Institution**: Rajalakshmi Engineering College (`@rajalakshmi.edu.in`)

---

## 1. Pre-Release Verification Gates

- [x] **Automated Tests**: Vitest test suite passing (294/294 tests green).
- [x] **Type Safety**: Zero TypeScript compilation errors (`npx tsc --noEmit`).
- [x] **Lint Quality**: Zero ESLint warnings or errors (`npm run lint`).
- [x] **Production Build**: Clean compilation (`npm run build`) with all 20 routes generated.
- [x] **Database Schema**: 27/27 PostgreSQL tables, RLS policies, trigger constraints, and performance indexes deployed.
- [x] **Security Scanners**: `gitleaks` clean, `npm audit` 0 high/critical vulnerabilities.
- [x] **Security Headers**: CSP, HSTS, X-Content-Type-Options: nosniff, frame-ancestors: 'none', Referrer-Policy configured.

---

## 2. Infrastructure & Account Separation

- [ ] **Production Supabase Project**: Separate project created on a paid tier by college admin.
- [ ] **Google OAuth Client**: Production OAuth 2.0 Client configured with:
  - Authorized Redirect URI: `https://<prod-project-ref>.supabase.co/auth/v1/callback`
  - User Type: `Internal` (or `In production` external)
- [ ] **Email Domain Setup**:
  - College sender configured (`noreply@rajalakshmi.edu.in` via Resend / SES).
  - SPF, DKIM, and DMARC records validated on DNS.
- [ ] **VAPID Keys**: Production web-push keypair generated and stored in hosting secrets.
- [ ] **Demo Mode Disabled**: `DEMO_ALLOWED_EMAILS` variable omitted from production environment.

---

## 3. Backups & Disaster Recovery

- [x] **Automated Daily Backups**: Enabled in Supabase project dashboard.
- [x] **Manual Snapshot / Encrypted Dump**: Export script validated (`supabase db dump`).
- [x] **Restore Rehearsal**: Backup restore procedure tested and documented in `docs/backup-and-rollback.md`.
- [x] **Rollback Plan**: Reversible migrations and previous deployment rollback rehearsed.

---

## 4. Monitoring, Logging & Privacy

- [x] **Zero PII in Logs**: Log redaction filter strips message content, tokens, and secrets from all structured logs.
- [x] **Health Check**: `/api/health` reports status of database, storage, and external providers without leaking secrets.
- [x] **Moderation Enforced**: 2-moderator consensus rule active for unblocking and appeals.
- [x] **Graduation Lifecycle**: Automatic deactivation active for accounts past their 4-year completion window (30 June).

---

## 5. Sign-Off & Approvals

| Role | Name | Signature / Approval Date |
| :--- | :--- | :--- |
| **System Owner** | Technical Project Lead | Pending Launch Sign-off |
| **College IT Administrator** | REC IT Dept | Pending Domain Delegation |
| **Security Reviewer** | Security Auditor | Pre-Launch Audit Completed |
