import { defineConfig, devices } from '@playwright/test';

const gameProjects = [
  { name: 'tak', port: 5190, pkg: '@abstract/tak', testMatch: '**/tak.spec.ts', timeout: 120_000 },
  { name: 'gomoku', port: 5192, pkg: '@abstract/gomoku', testMatch: '**/gomoku.spec.ts', timeout: 120_000 },
  { name: 'boop', port: 5194, pkg: '@abstract/boop', testMatch: '**/boop.spec.ts', timeout: 180_000 },
  { name: 'yinsh', port: 5196, pkg: '@abstract/yinsh', testMatch: '**/yinsh.spec.ts', timeout: 120_000 },
  { name: 'tzaar', port: 5199, pkg: '@abstract/tzaar', testMatch: '**/tzaar.spec.ts', timeout: 120_000 },
] as const;

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
  projects: gameProjects.map(g => ({
    name: g.name,
    testMatch: g.testMatch,
    use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${g.port}` },
  })),
  webServer: gameProjects.map(g => ({
    command: `npm run dev -w ${g.pkg}`,
    url: `http://127.0.0.1:${g.port}`,
    reuseExistingServer: !process.env.CI,
    timeout: g.timeout,
  })),
});
