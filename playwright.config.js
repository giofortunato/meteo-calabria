// Test end-to-end: l'app viene servita così com'è e Open-Meteo è simulato (tests/fixtures.js).
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8765",
    browserName: "chromium",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8765",
    url: "http://localhost:8765/",
    reuseExistingServer: !process.env.CI,
  },
});
