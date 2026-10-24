import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/boop-graduation.spec.ts',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5194',
  },
  webServer: {
    command: 'npm run dev -w boop-3d-demo',
    url: 'http://127.0.0.1:5194',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
