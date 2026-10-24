import { test, expect } from "@playwright/test";

test.describe("pixi-interact demo", () => {
  test("loads board and fake AI", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Fake AI move" })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "e2e/screenshots/demo-initial.png", fullPage: true });
    await page.getByRole("button", { name: "Fake AI move" }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "e2e/screenshots/demo-after-ai.png", fullPage: true });
  });
});
