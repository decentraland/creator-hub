import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { launchApp } from './helpers/app';
import { Auth } from './pageObjects/Auth';

const ANALYTICS_LINK = 'a.menu-item[href="/analytics"]';
const SIGN_IN_CARD = '.SignInCard';
const LOADER = '.AnalyticsPage .Loader';

let electronApp: ElectronApplication;
let cleanup: () => void;
let page: Page;

/**
 * The Analytics page while signed out. `status` starts at `idle` and the fetch is
 * gated on being signed in, so the page used to render a spinner that nothing
 * would ever resolve. Covered here rather than in a component test because the
 * card's styles moved out of `ManagePage`, and only a real render proves they
 * still apply.
 */
describe('analytics (signed out)', () => {
  beforeAll(async () => {
    ({ electronApp, cleanup } = await launchApp());
    page = await electronApp.firstWindow();

    /*
     * Analytics is dark behind `creatorhub-analytics`, and the localStorage override
     * that opens it locally is compiled out of the release build the e2e launches — so
     * the flag service is stubbed instead. Patched via `addInitScript` rather than
     * `page.route`: the flags are fetched with `credentials: 'include'`, so a fulfilled
     * response without CORS headers is rejected and the flags come back empty. This
     * runs before the app's own scripts, which the startup fetch requires.
     */
    await page.addInitScript(() => {
      const w = window as any;
      const realFetch = w.fetch.bind(w);
      w.fetch = async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : (input?.url ?? String(input));
        if (url.includes('creatorhub.json')) {
          return new Response(
            JSON.stringify({ flags: { 'creatorhub-analytics': true }, variants: {} }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return realFetch(input, init);
      };
    });
    await page.reload();
    await Auth.waitUntilReady(page);
  }, 120_000);

  afterAll(async () => {
    try {
      await electronApp?.close();
    } catch {
      // ignore teardown errors so they don't cascade into the next spec file
    } finally {
      cleanup?.();
    }
  });

  test('shows the Analytics entry once the flag is on', async () => {
    await page.waitForSelector(ANALYTICS_LINK, { state: 'visible' });

    expect(await page.locator(ANALYTICS_LINK).isVisible()).toBe(true);
  });

  test('offers to sign in instead of spinning forever', async () => {
    await page.locator(ANALYTICS_LINK).click();
    await page.waitForSelector('main.AnalyticsPage', { state: 'visible' });

    await page.waitForSelector(SIGN_IN_CARD, { state: 'visible' });
    expect(await page.locator(`${SIGN_IN_CARD} .SignInButton`).isVisible()).toBe(true);
    expect(await page.locator(LOADER).count(), 'a spinner with nothing in flight').toBe(0);
  });

  test('tells the creator what signing in is for', async () => {
    expect(await page.locator(`${SIGN_IN_CARD} .CardTitle`).innerText()).toMatch(/analytics/i);
  });

  /*
   * The card's CSS was scoped `.ManagePage .Card ...` when it lived under that page.
   * Now that both pages render it, the rules hang off `.SignInCard` — if that rewrite
   * missed, the card renders unstyled here and every assertion above still passes.
   */
  test('keeps its styling outside ManagePage', async () => {
    const padding = await page
      .locator(SIGN_IN_CARD)
      .evaluate(el => getComputedStyle(el).paddingTop);

    expect(padding).toBe('64px');
  });
});
