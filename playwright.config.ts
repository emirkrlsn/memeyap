import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Realtime olayları ve geliştirme sunucusunun ilk derlemesi birkaç saniye sürebilir.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile-download/,
    },
    // Android Chrome görünümü
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // iPhone Safari motoru (WebKit): sadece telefonda indirme testi
    {
      name: "iphone",
      use: { ...devices["iPhone 14"] },
      testMatch: /mobile-download/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
