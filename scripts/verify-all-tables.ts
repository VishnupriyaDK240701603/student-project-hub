import { createClient } from "@supabase/supabase-js";

async function verifyTables() {
  const url = "https://vwfkxwhlopsmbyqgeagz.supabase.co";
  const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Zmt4d2hsb3BzbWJ5cWdlYWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM1MjY0NiwiZXhwIjoyMTA2OTI4NjQ2fQ.WnXkGNTja2UW4_6IPT8rvoXq-q-5C_BbU_YpDgpQCS0";

  const supabase = createClient(url, serviceKey);

  const tables = [
    "profiles",
    "app_roles",
    "team_requests",
    "rooms",
    "room_members",
    "applications",
    "application_files",
    "lead_transfers",
    "mentor_invites",
    "messages",
    "reactions",
    "mentions",
    "tasks",
    "task_assignees",
    "task_comments",
    "task_attachments",
    "milestones",
    "meetings",
    "room_files",
    "notifications",
    "push_subscriptions",
    "reports",
    "report_snapshots",
    "justifications",
    "appeals",
    "audit_log",
    "ai_usage",
  ];

  console.log("=== SUPABASE DATABASE TABLE VERIFICATION ===\n");

  let passed = 0;
  let failed = 0;

  for (const table of tables) {
    const { error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`❌ Table [${table}]: Error - ${error.message}`);
      failed++;
    } else {
      console.log(`✅ Table [${table}]: Active & Connected (Rows: ${count ?? 0})`);
      passed++;
    }
  }

  console.log(`\nVerification Summary: ${passed}/${tables.length} tables verified successfully.`);
}

verifyTables();
