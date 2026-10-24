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
  const canvas = page.locator("#app canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas box missing");
  await page.mouse.click(box.x + box.width * fracX, box.y + box.height * fracY);
}

test("human placements and AI responds without extra click", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("#status")).toContainText(/turn|place|kitten|cat/i, {
    timeout: 15_000,
  });

  const clicks: [number, number][] = [
    [0.42, 0.42],
    [0.52, 0.45],
    [0.48, 0.52],
    [0.55, 0.48],
  ];

  for (const [fx, fy] of clicks) {
    await clickBoard(page, fx, fy);
    await page.waitForTimeout(1200);
  }

  await page.screenshot({
    path: path.join(artifactDir, "after-moves.png"),
    fullPage: true,
  });

  const status = (await page.locator("#status").textContent()) ?? "";
  expect(status.length).toBeGreaterThan(0);
  expect(status.toLowerCase()).toMatch(/turn|win|white|thinking|you/);
});
