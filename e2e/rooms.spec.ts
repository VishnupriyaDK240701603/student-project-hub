import { test, expect } from "@playwright/test";

test.describe("Rooms Route & Authentication Isolation (/rooms)", () => {
  test("redirects unauthenticated student visiting /rooms to /login", async ({ page }) => {
    await page.goto("/rooms");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects unauthenticated student visiting /rooms/[id] to /login", async ({ page }) => {
    await page.goto("/rooms/00000000-0000-0000-0000-000000000001");
    await expect(page).toHaveURL(/\/login/);
  });
});
