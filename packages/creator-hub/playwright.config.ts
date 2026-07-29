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
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  // Cold-launching a packaged Electron app plus a full scene flow is slow and
  // run-to-run variable on a contended runner.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: 'electron-offline',
      grep: /@offline/,
      workers: 1,
      fullyParallel: false,
      retries: process.env.CI ? 2 : 0,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      // No trace, no video, no screenshot: a @live run carries a real signed auth chain,
      // and Playwright traces record request headers verbatim. This repo is public, so
      // an uploaded trace would publish the identity. Diagnose from the job log, which
      // GitHub Actions already scrubs of registered secrets.
      name: 'electron-live',
      grep: /@live/,
      workers: 1,
      fullyParallel: false,
      // Retrying a partially-completed real deploy is worse than failing loudly.
      retries: 0,
      use: {
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
