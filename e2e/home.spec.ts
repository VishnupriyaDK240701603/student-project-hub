import { test, expect } from "@playwright/test";

test("redirects unauthenticated user to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/.*\/login/);
  await expect(page.locator("h1")).toContainText("Student Project Hub");
  await expect(page.getByText("Rajalakshmi Engineering College")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in with Google/i })).toBeVisible();
  await expect(page.getByText(/rajlakshmi\.edu\.in/)).toBeVisible();
});

test("shows blocked page message", async ({ page }) => {
  await page.goto("/blocked");
  await expect(page.locator("h1")).toContainText("Account Restricted");
});
