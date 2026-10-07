# Operational Runbook & Observability Guide

**Student Project Hub**
**Target**: Production Monitoring, Alert Thresholds, and Incident Procedures

---

## 1. System Observability Overview
Student Project Hub relies on zero-content structured logging, an unauthenticated health check endpoint, and defensive timeouts.

- **Health Endpoint**: `GET /api/health`
- **Structured Logs**: Emitted as JSON to stdout; parsed by container runtime or hosting platform.
- **Privacy Standard**: Logs contain event names, request IDs, actor/target IDs, and timestamps. Logs NEVER contain user passwords, auth tokens, chat message text, or raw file bodies.

---

## 2. Production Alert Configuration Checklist

Configure the following alerts in your hosting dashboard (e.g. Vercel / Supabase Platform):

### A. Uptime & Availability
- **Endpoint**: `https://<domain>/api/health`
- **Check Frequency**: Every 1 minute
- **Alert Condition**: HTTP status != 200 or response time > 3000ms for 2 consecutive checks.
- **Severity**: P1 - Critical (Notify on-call engineering).

### B. Error Rate Alerts
- **Metric**: 5xx HTTP Responses / Total Requests
- **Warning Threshold**: > 0.5% over 5 minutes
- **Critical Threshold**: > 2.0% over 5 minutes
- **Action**: Inspect server logs for `level: "error"` and incident references (`digest`).

### C. Free-Tier Quota & Resource Warnings
- **Supabase Database Egress**: Alert at 80% of monthly tier allocation.
- **Supabase Storage Egress**: Alert at 80% of storage cap.
- **Resend Email API Quota**: Alert at 85% of daily/monthly transactional email limit.
- **Hugging Face Serverless Token Allowance**: Alert when daily usage exceeds 80% of token budget.

### D. AI Usage Anomaly Alerts
- **Metric**: Queries per minute across all rooms
- **Alert Threshold**: > 100 queries/minute (potential abuse or runaway loop)
- **Automated Defense**: Server enforces 20 queries/user/day hard cap.

---

## 3. Incident Response & Troubleshooting Playbook

### Playbook 1: Supabase Database Connectivity Failure
1. Check `GET /api/health` response: `dependencies.database: "unreachable"`.
2. Inspect Supabase project status in Supabase Dashboard.
3. Verify connection pooling (Transaction mode on port 6543 / Session mode on port 5432).
4. Restart application container / edge instances.

### Playbook 2: Third-Party Notification Failure (Resend / Push)
1. **Behavior**: System degrades gracefully; notifications are recorded in `notifications` table even if email/push delivery fails.
2. Inspect server logs for `event: "email_dispatch_failed"` or `event: "push_dispatch_failed"`.
3. Check API key validity and domain verification in Resend console.

### Playbook 3: Hugging Face Rate Limit or Downtime
1. **Behavior**: `@ai` assistant returns friendly fallback: *"The AI assistant is temporarily unavailable. Please try again shortly."*
2. Check Hugging Face status at `status.huggingface.co`.
3. Verify `HF_TOKEN` secret in environment variables.

---

## 4. Error-Tracking Integration Note
Per institutional privacy guidelines, third-party error tracking tools (e.g. Sentry) must be configured with PII scrubbing and data anonymization before deployment.
