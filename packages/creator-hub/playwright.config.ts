import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Loaded so the @live tier can read E2E_PRIVATE_KEY / E2E_NAME / E2E_WALLET from a
// local .env.e2e. `.env*` is gitignored — never commit one.
loadDotenv({ path: join(__dirname, '.env.e2e') });

/**
 * The suite drives the **packaged** app (`npm run compile` → `electron-builder --dir`),
 * not `electron .`. That is what lets every `process.env.E2E` branch stay out of
 * production source: `APP_UNPACKED_PATH` resolves correctly only when
 * `Contents/Resources/app.asar.unpacked` actually exists, which packaging provides.
 *
 * Two projects, split by tag:
 *
 *   electron-offline  no secrets at all — the auth-server boundary is intercepted and
 *                     the browser handoff stubbed, so this runs on every PR.
 *   electron-live     drives a real signed identity against real Decentraland services.
 *                     Runs only post-merge / on manual dispatch.
 *
 * `workers: 1` + `fullyParallel: false` keep exactly one Electron instance alive at a
 * time. This replaces vitest's `pool: 'forks'` + `fileParallelism: false`, which existed
 * because accumulated Chromium/Babylon native memory killed the runner at a moving
 * spec-file boundary. Playwright reuses one worker across files, so the per-file
 * reclamation is gone — but the native memory lives in the Electron *child* process,
 * which `electronApp.close()` reaps. See docs/testing-standards.md.
 */
export default defineConfig<{ appArgs: string[] }>({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  workers: 1,
  // Cold-launching a packaged Electron app plus a full scene flow is slow and
  // run-to-run variable on a contended runner.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: 'electron-offline',
      grep: /@offline/,
      fullyParallel: false,
      retries: process.env.CI ? 2 : 0,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      // Not @offline: creating a scene dispatches `installProject` -> `npm.install`, a real
      // registry install into the scene folder. These specs can therefore fail because npm is
      // slow or down rather than because the app broke, so they stay out of the PR-blocking
      // set — that is what keeps @offline's "cannot fail from someone else's outage" true.
      name: 'electron-scene',
      grep: /@scene/,
      fullyParallel: false,
      retries: process.env.CI ? 1 : 0,
      // Scene creation plus an inspector iframe load is the slowest thing the suite does.
      timeout: 300_000,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'electron-live-auth',
      testMatch: /specs\/live\/auth\.setup\.ts$/,
      fullyParallel: false,
      retries: 0,
      timeout: 300_000,
      use: {
        appArgs: ['--env=dev'],
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    },
    {
      name: 'electron-live',
      grep: /@live/,
      dependencies: ['electron-live-auth'],
      fullyParallel: false,
      retries: 0,
      timeout: 1_200_000,
      use: {
        appArgs: ['--env=dev'],
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
