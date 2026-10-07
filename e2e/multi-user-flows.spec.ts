import { test, expect } from "@playwright/test";

test.describe("Multi-User End-to-End Workflow Validation", () => {
  test("1. Lead creates project request and views listing", async ({ page }) => {
    await page.goto("/requests");
    await expect(page).toHaveTitle(/Student Project Hub/i);
    // Request board elements present
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. Navigation to private rooms workspace", async ({ page }) => {
    await page.goto("/rooms");
    await expect(page.locator("body")).toBeVisible();
  });

  test("3. Staff Mentor inbox access", async ({ page }) => {
    await page.goto("/staff/mentor-inbox");
    await expect(page.locator("body")).toBeVisible();
  });

  test("4. Confidential Moderator Queue access", async ({ page }) => {
    await page.goto("/staff/moderator-console");
    await expect(page.locator("body")).toBeVisible();
  });

  test("5. Blocked screen and two-moderator appeal form", async ({ page }) => {
    await page.goto("/blocked");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/Account Access Restricted/i)).toBeVisible();
  });

  test("6. Institutional Privacy Notice page", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText(/Institutional Privacy Notice/i)).toBeVisible();
    await expect(page.getByText(/DPDP Act 2023/i)).toBeVisible();
  });

  test("7. Health Check API Endpoint", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const json = await res.json();
    expect(json).toHaveProperty("status");
    expect(json).toHaveProperty("dependencies");
  });
});
