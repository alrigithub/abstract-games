import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'tak',
      testMatch: '**/tak.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5190' },
    },
    {
      name: 'gomoku',
      testMatch: '**/gomoku.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5192' },
    },
    {
      name: 'menu-screenshots',
      testMatch: '**/game-menu-screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'unified-lighting-screenshots',
      testMatch: '**/unified-lighting-screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w tak-3d',
      url: 'http://127.0.0.1:5190',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w gomoku-3d-demo',
      url: 'http://127.0.0.1:5192',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w boop-3d-demo',
      url: 'http://127.0.0.1:5194',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run dev -w yinsh-3d-demo',
      url: 'http://127.0.0.1:5196',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w tzaar-3d-demo',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
