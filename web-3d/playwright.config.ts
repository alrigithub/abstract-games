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
      name: 'flat-board-iso-screenshots',
      testMatch: '**/flat-board-iso-screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'tap-placement',
      testMatch: '**/tap-placement.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'unified-lighting-screenshots',
      testMatch: '**/unified-lighting-screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'five-games-preview-smoke',
      testMatch: '**/five-games-preview-smoke.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'shadow-lighting-before',
      testMatch: ['**/shadow-lighting-screenshots-before.spec.ts', '**/shadow-lighting-bench-before.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'shadow-lighting',
      testMatch: ['**/shadow-lighting-screenshots.spec.ts', '**/shadow-lighting-bench.spec.ts'],
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
    {
      command: 'npm run preview -w tak-3d -- --host 127.0.0.1 --port 5290',
      url: 'http://127.0.0.1:5290',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run preview -w gomoku-3d-demo -- --host 127.0.0.1 --port 5292',
      url: 'http://127.0.0.1:5292',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run preview -w boop-3d-demo -- --host 127.0.0.1 --port 5294',
      url: 'http://127.0.0.1:5294',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run preview -w yinsh-3d-demo -- --host 127.0.0.1 --port 5296',
      url: 'http://127.0.0.1:5296',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run preview -w tzaar-3d-demo -- --host 127.0.0.1 --port 5299',
      url: 'http://127.0.0.1:5299',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
