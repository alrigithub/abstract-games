import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'yinsh-ring-closeup.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w @abstract/yinsh',
      url: 'http://127.0.0.1:5196',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w @abstract/tzaar',
      url: 'http://127.0.0.1:5198',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
