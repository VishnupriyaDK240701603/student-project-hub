/**
 * Staging Smoke-Test Script
 * Exercises the primary paths against a live staging deployment.
 * 
 * Usage:
 *   npx tsx scripts/staging-smoke-test.ts https://staging-student-project-hub.vercel.app
 */

async function runSmokeTests() {
  const targetUrl = process.argv[2] || "http://localhost:3000";
  console.log(`\n🔍 Starting Staging Smoke Tests against: ${targetUrl}\n`);

  const tests = [
    {
      name: "1. Health Endpoint Check (/api/health)",
      path: "/api/health",
      expectedStatus: 200,
      validate: (data: unknown) => {
        const payload = data as { status?: string; dependencies?: Record<string, string> };
        return Boolean(payload?.status && payload?.dependencies);
      },
    },
    {
      name: "2. Privacy Notice Page (/privacy)",
      path: "/privacy",
      expectedStatus: 200,
    },
    {
      name: "3. Blocked Account Screen (/blocked)",
      path: "/blocked",
      expectedStatus: 200,
    },
    {
      name: "4. Login Screen (/login)",
      path: "/login",
      expectedStatus: 200,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const url = `${targetUrl}${t.path}`;
      const res = await fetch(url, { headers: { "User-Agent": "SmokeTestRunner/1.0" } });

      if (res.status !== t.expectedStatus) {
        console.error(`❌ [FAIL] ${t.name}: Expected ${t.expectedStatus}, received ${res.status}`);
        failed++;
        continue;
      }

      if (t.validate) {
        const json = await res.json();
        if (!t.validate(json)) {
          console.error(`❌ [FAIL] ${t.name}: Validation predicate failed on response payload.`);
          failed++;
          continue;
        }
      }

      console.log(`✅ [PASS] ${t.name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`❌ [FAIL] ${t.name}: Request error -`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Smoke Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests();
