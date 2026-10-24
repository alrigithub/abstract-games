import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
  },
});
