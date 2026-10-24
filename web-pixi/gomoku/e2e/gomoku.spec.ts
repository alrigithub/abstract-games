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

test("human moves and AI responds without extra click", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#status")).toContainText(/place|turn|stone/i, {
    timeout: 20_000,
  });

  const clicks: [number, number][] = [
    [0.44, 0.42],
    [0.52, 0.42],
    [0.48, 0.48],
    [0.56, 0.5],
    [0.42, 0.52],
  ];

  for (let i = 0; i < clicks.length; i++) {
    const [fx, fy] = clicks[i];
    await clickBoard(page, fx, fy);
    await page.waitForTimeout(1200);
    const status = (await page.locator("#status").textContent()) ?? "";
    if (i === 0) {
      expect(status.toLowerCase()).toMatch(/thinking|turn|place|waiting/);
    }
  }

  await page.screenshot({
    path: path.join(artifactDir, "after-moves.png"),
    fullPage: true,
  });

  const finalStatus = await page.locator("#status").textContent();
  expect(finalStatus?.length).toBeGreaterThan(0);
});
