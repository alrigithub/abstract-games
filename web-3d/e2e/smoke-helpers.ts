import { expect, type Page } from '@playwright/test';

export function attachPageErrorCollectors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

export async function waitForBoardCanvas(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await page.waitForSelector('[data-testid="board"] canvas', { timeout: 120_000 });
  await expect(page.locator('[data-testid="board"] canvas')).toBeVisible();
}

export async function clickBoardFraction(page: Page, fx: number, fy: number): Promise<void> {
  const box = await page.locator('[data-testid="board"]').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width * fx, box!.y + box!.height * fy);
}
