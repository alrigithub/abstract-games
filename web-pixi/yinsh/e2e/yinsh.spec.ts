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

test("human rings, AI responds, marker placement", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#status")).toContainText(/ring|turn/i, {
    timeout: 20_000,
  });

  // Five human ring placements (AI answers between turns).
  const ringClicks: [number, number][] = [
    [0.42, 0.38],
    [0.48, 0.42],
    [0.52, 0.38],
    [0.46, 0.48],
    [0.54, 0.46],
  ];

  for (const [fx, fy] of ringClicks) {
    await clickBoard(page, fx, fy);
    await page.waitForTimeout(900);
  }

  await page.screenshot({
    path: path.join(artifactDir, "after-rings.png"),
    fullPage: true,
  });

  const statusAfterRings = await page.locator("#status").textContent();
  expect(statusAfterRings?.toLowerCase()).toMatch(/marker|ring|turn|floyd/);

  // Marker phase: try center-ish clicks until status mentions ring movement or marker placed.
  for (let i = 0; i < 8; i++) {
    await clickBoard(page, 0.5, 0.44);
    await page.waitForTimeout(700);
    const t = (await page.locator("#status").textContent()) ?? "";
    if (/move your ring|marker|floyd|thinking/i.test(t)) break;
  }

  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(artifactDir, "after-marker.png"),
    fullPage: true,
  });

  const finalStatus = await page.locator("#status").textContent();
  expect(finalStatus?.length).toBeGreaterThan(0);
});
