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

test("opening flats, several turns, AI responds without extra click", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("#status")).toContainText(/opening flat|place/i, {
    timeout: 15_000,
  });

  // Human opening flat
  await clickBoard(page, 0.44, 0.42);
  await expect(page.locator("#status")).toContainText(/Floyd|thinking/i, {
    timeout: 8000,
  });
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(artifactDir, "after-opening.png"),
    fullPage: true,
  });

  // Several midgame placements / moves
  const clicks: [number, number][] = [
    [0.5, 0.44],
    [0.46, 0.48],
    [0.52, 0.46],
    [0.48, 0.4],
  ];

  for (const [fx, fy] of clicks) {
    await clickBoard(page, fx, fy);
    await page.waitForTimeout(400);
    const status = (await page.locator("#status").textContent()) ?? "";
    if (/thinking/i.test(status)) {
      await expect(page.locator("#status")).not.toContainText(/thinking/i, {
        timeout: 12_000,
      });
    } else {
      await page.waitForTimeout(900);
    }
  }

  await page.screenshot({
    path: path.join(artifactDir, "midgame.png"),
    fullPage: true,
  });

  const finalStatus = await page.locator("#status").textContent();
  expect(finalStatus?.length).toBeGreaterThan(0);
});
