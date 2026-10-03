const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // The multi-context cross-tab suite (fullstack-sync.spec.js) performs five
  // sequential expect-windows across three browser contexts; it needs ~15s
  // solo and more under full-suite parallel load, so 30s is too tight.
  timeout: 90000,
  retries: 0,
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://127.0.0.1:8080/BrainzOS.html',
    reuseExistingServer: true,
    timeout: 10000
  },
  use: {
    baseURL: 'http://127.0.0.1:8080',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000
  }
});
