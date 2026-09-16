import { test as base } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { type LaunchedApp, launchApp } from './helpers/app';
import { seedIdentity } from './helpers/auth-identity';
import { Auth } from './pages/Auth';

type AppFixtures = {
  /** Extra CLI arguments for the packaged app; set per project via `use`. */
  appArgs: string[];
  /** When true, the `page` fixture seeds the captured `@live` identity and waits for signed-in. */
  signedIn: boolean;
  /** A freshly launched packaged app, torn down after the test. */
  electronApp: ElectronApplication;
  /** The app's first window, ready (and signed in when `signedIn` is set). */
  page: Page;
  /** The throwaway user-data dir; scenes are created under `<userDataDir>/Scenes`. */
  userDataDir: string;
};

/** Owns the launch/teardown so `electronApp` and `homeDir` describe the same instance. */
type InternalFixtures = { launchedApp: LaunchedApp };

export const test = base.extend<AppFixtures & InternalFixtures>({
  appArgs: [[], { option: true }],
  signedIn: [false, { option: true }],

  launchedApp: async ({ appArgs }, use) => {
    const launched = await launchApp({ extraArgs: appArgs });
    try {
      await use(launched);
    } finally {
      try {
        await launched.electronApp.close();
      } catch {
        void 0;
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

  page: async ({ electronApp, signedIn }, use) => {
    const page = await electronApp.firstWindow();
    const auth = new Auth(page);
    await auth.waitUntilReady();
    if (signedIn) {
      await seedIdentity(page);
      await auth.waitUntilReady();
      await auth.waitForSignedIn();
    }
    await use(page);
  },
});

export { expect } from '@playwright/test';
