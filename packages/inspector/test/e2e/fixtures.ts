import { test as base } from '@playwright/test';
import type { Page } from 'playwright';

import { mockContentRequests } from './utils/mock-content';

type WorkerFixtures = {
  /** One booted inspector, shared by every spec file this worker runs. */
  inspector: Page;
};

/** The navigation URL the worker booted with, for specs that re-navigate with extra params. */
export let navUrl = '';

async function boot(page: Page): Promise<void> {
  const serverUrl = process.env.E2E_URL || 'http://localhost:8000';
  const contentUrl = process.env.E2E_CONTENT_URL || 'https://builder-items.decentraland.zone';

  page.setDefaultTimeout(60_000);

  const consoleLogs: string[] = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[pageerror] ${err.message}`));
  (globalThis as Record<string, unknown>).__e2eConsoleLogs = consoleLogs;

  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent =
      '*, *::before, *::after { animation-duration: 0.01ms !important; animation-delay: -0.01ms !important; transition-duration: 0.01ms !important; transition-delay: -0.01ms !important; }';
    document.head.appendChild(style);
  });

  await mockContentRequests(page, contentUrl);

  navUrl = `${serverUrl}?contentUrl=${encodeURIComponent(contentUrl)}`;
  (globalThis as Record<string, unknown>).E2E_URL = serverUrl;
  (globalThis as Record<string, unknown>).__e2eNavUrl = navUrl;

  await page.goto(navUrl, { timeout: 90_000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
}

export const test = base.extend<object, WorkerFixtures>({
  inspector: [
    async ({ browser }, use) => {
      const page = await browser.newPage({
        viewport: process.env.CI ? { width: 1920, height: 1080 } : { width: 1280, height: 720 },
      });
      await boot(page);
      (globalThis as Record<string, unknown>).page = page;
      await use(page);
      await page.close();
    },
    { scope: 'worker', auto: true },
  ],
});

export { expect } from '@playwright/test';
