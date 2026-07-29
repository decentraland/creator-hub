import { test as base } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/app';

type AppFixtures = {
  /** A freshly launched packaged app, torn down after the test. */
  electronApp: ElectronApplication;
  /** The app's first window, already rendered. */
  page: Page;
};

/**
 * `test` for specs whose tests are independent: each gets its own packaged-app instance
 * with throwaway user-data and home directories.
 *
 * Specs whose tests form a dependent chain (the sign-in flow: open → request → deeplink →
 * signed in) cannot use this — they need one app across several tests. Those call
 * `launchApp()` from `test.beforeAll` and declare
 * `test.describe.configure({ mode: 'serial' })`, so a broken link fails the rest of the
 * chain instead of reporting several confusing failures. Playwright has no per-file
 * fixture scope, which is why both shapes exist.
 */
export const test = base.extend<AppFixtures>({
  // Playwright inspects the source of the first parameter to work out which fixtures this
  // one depends on, and rejects anything that is not a destructuring pattern
  // ("First argument must use the object destructuring pattern"). This fixture has no
  // dependencies, so the pattern must be empty — which trips `no-empty-pattern`.
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    const { electronApp, cleanup } = await launchApp();
    try {
      await use(electronApp);
    } finally {
      try {
        await electronApp.close();
      } catch {
        // ignore teardown errors so they don't mask the test result
      }
      cleanup();
    }
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForSelector('#app main.Main', { state: 'visible' });
    await use(page);
  },
});

export { expect } from '@playwright/test';
