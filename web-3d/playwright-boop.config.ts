import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/boop-graduation.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5194',
  },
  webServer: {
    command: 'npm run dev -w @abstract/boop',
    url: 'http://127.0.0.1:5194',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
