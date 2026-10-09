import { createClient } from "@supabase/supabase-js";

async function verifyTables() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  }

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
