import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:8000',
    actionTimeout: 15_000,
    navigationTimeout: 90_000,
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
