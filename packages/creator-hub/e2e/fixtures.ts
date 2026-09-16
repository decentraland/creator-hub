import { test as base } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { type LaunchedApp, launchApp } from './helpers/app';
import { seedLiveState } from './helpers/live-auth';
import { Auth } from './pageObjects/Auth';

type AppFixtures = {
  /** Extra CLI arguments for the packaged app; set per project via `use`. */
  appArgs: string[];
  /** A freshly launched packaged app, torn down after the test. */
  electronApp: ElectronApplication;
  /** The app's first window, already rendered. */
  page: Page;
  /** The throwaway user-data dir; scenes are created under `<userDataDir>/Scenes`. */
  userDataDir: string;
  /** The app's first window, already signed in as the wallet the `@live` setup captured. */
  signedInLive: Page;
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
/** Owns the launch/teardown so `electronApp` and `homeDir` describe the same instance. */
type InternalFixtures = { launchedApp: LaunchedApp };

export const test = base.extend<AppFixtures & InternalFixtures>({
  appArgs: [[], { option: true }],

  launchedApp: async ({ appArgs }, use) => {
    const launched = await launchApp({ extraArgs: appArgs });
    try {
      await use(launched);
    } finally {
      try {
        await launched.electronApp.close();
      } catch {
        // ignore teardown errors so they don't mask the test result
      }
      launched.cleanup();
    }
  },

  electronApp: async ({ launchedApp }, use) => {
    await use(launchedApp.electronApp);
  },

  userDataDir: async ({ launchedApp }, use) => {
    await use(launchedApp.userDataDir);
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForSelector('#app main.Main', { state: 'visible' });
    await use(page);
  },

  signedInLive: async ({ page }, use) => {
    await seedLiveState(page);
    await Auth.waitUntilReady(page);
    await Auth.waitForSignedIn(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
