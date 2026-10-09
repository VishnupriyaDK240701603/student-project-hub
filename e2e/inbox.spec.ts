import { test, expect } from "@playwright/test";

test("redirects unauthenticated user visiting /inbox to /login", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page).toHaveURL(/.*\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
