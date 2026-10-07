import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Design System & PWA Shell (/design)", () => {
  test.beforeAll(() => {
    const screenshotDir = path.join(process.cwd(), "docs/screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test("renders all components and takes responsive screenshots at 360, 768, and 1280px", async ({
    page,
  }) => {
    // 1. Desktop (1280px)
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/design");

    await expect(page.locator("h1")).toContainText("Design System & Component Showcase");
    await expect(page.getByRole("button", { name: "Primary", exact: true })).toBeVisible();
    await expect(page.getByText("Full Name")).toBeVisible();
    await expect(page.getByText("Semantic Status Badges")).toBeVisible();

    await page.screenshot({
      path: "docs/screenshots/design-1280px.png",
      fullPage: true,
    });

    // 2. Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({
      path: "docs/screenshots/design-768px.png",
      fullPage: true,
    });

    // 3. Mobile phone (360px)
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({
      path: "docs/screenshots/design-360px.png",
      fullPage: true,
    });

    // 4. Dark Mode screenshot (1280px)
    await page.setViewportSize({ width: 1280, height: 900 });
    // Click theme toggle to enable dark mode
    const themeBtn = page.getByRole("button", { name: /switch to dark mode/i });
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({
      path: "docs/screenshots/design-dark-1280px.png",
      fullPage: true,
    });
  });

  test("interacts with overlays: Dialog and Sheet", async ({ page }) => {
    await page.goto("/design");

    // Test Dialog modal
    await page.getByRole("button", { name: "Open Dialog Modal" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Project Request" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Test Sheet drawer
    await page.getByRole("button", { name: "Open Side Sheet Drawer" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Room Member List" })).toBeVisible();
    await page.getByRole("button", { name: "Close sheet" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("passes PWA manifest and installability check", async ({ page, request }) => {
    await page.goto("/design");

    // Verify manifest link tag in DOM
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "/manifest.json");

    // Fetch and validate manifest JSON
    const response = await request.get("/manifest.json");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toContain("Student Project Hub");
    expect(manifest.short_name).toBe("ProjectHub");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("automated accessibility checks for form labels, ARIA landmarks, and focusable controls", async ({
    page,
  }) => {
    await page.goto("/design");

    // Verify all input elements have associated labels or aria-labels
    const inputs = await page.locator("input:not([type='hidden'])").all();
    for (const input of inputs) {
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
      expect(Boolean(hasLabel || ariaLabel)).toBe(true);
    }

    // Verify all buttons have accessible text or aria-label
    const buttons = await page.getByRole("button").all();
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute("aria-label");
      const text = await button.textContent();
      const hasAccessibleName = Boolean(ariaLabel?.trim() || text?.trim());
      expect(hasAccessibleName).toBe(true);
    }

    // Verify main landmark exists
    await expect(page.locator("main")).toBeVisible();
  });
});
