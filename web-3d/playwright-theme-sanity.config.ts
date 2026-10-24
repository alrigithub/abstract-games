import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/theme-invert-screenshots.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'] },
  webServer: [
    {
      command: 'npm run dev -w @abstract/tak',
      url: 'http://127.0.0.1:5190',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w @abstract/gomoku',
      url: 'http://127.0.0.1:5192',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w @abstract/tzaar',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
