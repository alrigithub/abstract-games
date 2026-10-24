import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5192',
  },
  projects: [
    { name: 'gomoku', testMatch: '**/gomoku.spec.ts' },
    { name: 'gomoku-win-glow', testMatch: '**/gomoku-win-glow.spec.ts' },
    { name: 'gomoku-arena-screenshots', testMatch: '**/gomoku-arena-screenshots.spec.ts' },
  ],
  webServer: {
    command: 'npm run dev -w gomoku-3d-demo -- --host 127.0.0.1 --port 5192',
    url: 'http://127.0.0.1:5192',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
