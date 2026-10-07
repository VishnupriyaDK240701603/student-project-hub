# Deployment & Environment Setup Guide

**Student Project Hub**
**Target**: Staging & Production Deployment Procedures

---

## 1. Prerequisites
- **Node.js**: v20.x or higher
- **Supabase CLI**: Installed (`npm i -g supabase`)
- **Hosting CLI**: Vercel CLI (`npm i -g vercel`) or Cloudflare Wrangler

---

## 2. Supabase Migration Deployment

### Dry Run Migrations
```bash
supabase db diff --use-migra
```

### Apply Migrations to Remote Project
```bash
supabase link --project-ref <YOUR_STAGING_OR_PROD_PROJECT_ID>
supabase db push
```

---

## 3. Environment Variables Configuration

Set the following variables in the hosting provider dashboard:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-private-key>

# Institutional Domain & Auth
NEXT_PUBLIC_SITE_URL=https://<your-staging-or-production-domain>
DEMO_ALLOWED_EMAILS=student.a.22.cse@rajlakshmi.edu.in,faculty.b.cse@rajlakshmi.edu.in

# AI Model Configuration (Prompt 16)
AI_ENABLED=false
HF_TOKEN=<your-hugging-face-api-token>
HF_MODEL_ID=meta-llama/Llama-3.2-3B-Instruct

# Email Service (Resend)
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM="Student Project Hub <noreply@rajlakshmi.edu.in>"

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
VAPID_SUBJECT="mailto:admin@rajlakshmi.edu.in"
```

---

## 4. Staging Deployment & Verification

1. Deploy application to staging:
   ```bash
   vercel --build-env NEXT_PUBLIC_SITE_URL="https://staging.domain.com"
   ```
2. Execute the smoke test:
   ```bash
   npx tsx scripts/staging-smoke-test.ts https://staging.domain.com
   ```
