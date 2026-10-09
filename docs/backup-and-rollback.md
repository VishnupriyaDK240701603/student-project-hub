# Database Backup, Restore, and Rollback Procedures

**Student Project Hub**
**Target**: Disaster Recovery and Emergency Rollback Operations

---

## 1. Automated & Manual Backups

### Automated Backups (Supabase Platform)
- **Schedule**: Nightly automated physical backups with Point-In-Time-Recovery (PITR) enabled on paid tiers.
- **Retention**: 7 to 30 days based on tier.

### Manual Encrypted Logical Backup
To create an on-demand SQL dump before running a major migration:

```bash
# Export schema + data
supabase db dump --db-url "$DATABASE_URL" -f backup_$(date +%Y%m%d_%H%M%S).sql

# Encrypt backup file
gpg --symmetric --cipher-algo AES256 backup_*.sql
```

---

## 2. Restore Rehearsal & Verification

### Disaster Recovery Restore Steps
1. **Provision/Reset Target Database**:
   ```bash
   supabase db reset
   ```
2. **Apply Verified Schema & Data**:
   ```bash
   # Decrypt backup
   gpg --decrypt backup_YYYYMMDD_HHMMSS.sql.gpg > restore.sql

   # Restore into PostgreSQL instance
   psql "$DATABASE_URL" -f restore.sql
   ```
3. **Verify Integrity**:
   ```bash
   npx tsx scripts/verify-all-tables.ts
   ```

---

## 3. Emergency Rollback Plan

### Web Application Rollback
If a faulty deployment causes runtime issues in production:
1. **Vercel / Cloudflare Instant Rollback**:
   - Go to Deployment History &rarr; Select previous healthy build &rarr; Click **"Instant Rollback / Promote to Production"** (< 30 seconds).
2. **CLI Rollback**:
   ```bash
   vercel rollback <PREVIOUS_DEPLOYMENT_URL>
   ```

### Database Migration Rollback
If a schema migration must be reverted:
1. Execute the corresponding down-migration script or restore from the pre-migration snapshot taken in step 1.
2. Verify table permissions and RLS policies using `src/db/rls.test.ts`.
