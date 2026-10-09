import { test, expect } from "@playwright/test";

test("redirects unauthenticated user to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/.*\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Rajalakshmi Engineering College").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  await expect(page.getByText(/Institutional access/i)).toBeVisible();
});

test("shows blocked page message", async ({ page }) => {
  await page.goto("/blocked");
  await expect(page.locator("h1")).toContainText("Account Access Restricted");
});

