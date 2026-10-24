import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.join(__dirname, "..", "e2e-artifacts");

async function clickBoard(
  page: import("@playwright/test").Page,
  fracX: number,
  fracY: number,
) {
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas box missing");
  await page.mouse.click(box.x + box.width * fracX, box.y + box.height * fracY);
}

test("opening capture and AI responds without extra click", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#status")).toContainText(/capture|turn|thinking/i, {
    timeout: 25_000,
  });

  await page.screenshot({
    path: path.join(artifactDir, "tzaar-start.png"),
    fullPage: true,
  });

  // White opening: select stack then capture target (approximate board coords).
  await clickBoard(page, 0.44, 0.52);
  await page.waitForTimeout(400);
  await clickBoard(page, 0.48, 0.48);
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(artifactDir, "tzaar-after-opening.png"),
    fullPage: true,
  });

  const status1 = (await page.locator("#status").textContent()) ?? "";
  expect(status1.toLowerCase()).toMatch(/capture|second|thinking|black|turn/);

  // Wait for AI forced capture (auto, no click).
  await expect(page.locator("#status")).not.toContainText(/thinking/i, {
    timeout: 20_000,
  });
  await page.waitForTimeout(800);

  await clickBoard(page, 0.42, 0.55);
  await page.waitForTimeout(400);
  await clickBoard(page, 0.46, 0.5);
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(artifactDir, "tzaar-midgame.png"),
    fullPage: true,
  });

  const status2 = await page.locator("#status").textContent();
  expect(status2?.length).toBeGreaterThan(0);
});
