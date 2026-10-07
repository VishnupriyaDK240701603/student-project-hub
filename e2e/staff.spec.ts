import { test, expect } from "@playwright/test";

test.describe("Staff Console & Mentor Inbox Route Isolation (/staff)", () => {
  test("redirects unauthenticated user visiting /staff to /login", async ({ page }) => {
    await page.goto("/staff");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects unauthenticated user visiting /staff/mentor-inbox to /login", async ({ page }) => {
    await page.goto("/staff/mentor-inbox");
    await expect(page).toHaveURL(/\/login/);
  });
});
