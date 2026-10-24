import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    screenshot: "off",
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    cwd: import.meta.dirname,
  },
});
