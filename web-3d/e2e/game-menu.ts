import { expect, type Page } from '@playwright/test';

export async function openGameMenu(page: Page): Promise<void> {
  await page.click('[data-testid="game-menu-toggle"]');
  await expect(page.locator('[data-testid="game-menu"]')).toBeVisible();
}
