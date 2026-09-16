import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from 'playwright';
import { creatorHubDir } from './app';

const DEEPLINK_SCHEME = 'dcl-creator-hub://';
const TESTNET_AUTH_API = 'auth-api.decentraland.zone';
const MAINNET_AUTH_API = 'auth-api.decentraland.org';

/** Gitignored file holding the renderer localStorage captured by the `electron-live-auth` setup. */
export const IDENTITY_STATE_PATH = join(creatorHubDir, 'e2e', '.auth', 'live-state.json');

/** Dumps the signed-in renderer's localStorage so later `@live` tests can reuse the identity. */
export async function saveIdentity(page: Page): Promise<void> {
  const entries = await page.evaluate(() => ({ ...localStorage }));
  mkdirSync(dirname(IDENTITY_STATE_PATH), { recursive: true });
  writeFileSync(IDENTITY_STATE_PATH, JSON.stringify(entries, null, 2));
}

/** Restores the captured identity into a freshly launched app and reloads it. */
export async function seedIdentity(page: Page): Promise<void> {
  if (!existsSync(IDENTITY_STATE_PATH)) {
    throw new Error(
      `e2e: ${IDENTITY_STATE_PATH} is missing — run the electron-live-auth setup project first`,
    );
  }

  const entries = JSON.parse(readFileSync(IDENTITY_STATE_PATH, 'utf8')) as Record<string, string>;
  await page.evaluate(stored => {
    for (const [key, value] of Object.entries(stored)) {
      localStorage.setItem(key, value);
    }
  }, entries);
  await page.reload();
}

/**
 * Rewrites the auth-dapp URL the app opened into one that loads on `decentraland.org`.
 *
 * @remarks Carries `env=dev` on both the login URL and its `redirectTo`. See docs/testing-standards.md.
 */
export function authDappUrl(openedUrl: string): string {
  const opened = new URL(openedUrl);
  const loginUrl = new URL('https://decentraland.org/auth/login');
  loginUrl.searchParams.set('redirectTo', `${opened.pathname}${opened.search}&env=dev`);
  loginUrl.searchParams.set('targetConfigId', opened.searchParams.get('targetConfigId') ?? '');
  loginUrl.searchParams.set('env', 'dev');
  return loginUrl.href;
}

/** Records the `dcl-creator-hub://` deeplink the dapp fires through a hidden iframe. */
export async function captureDeepLink(page: Page): Promise<void> {
  await page.addInitScript(scheme => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    const originalSet = descriptor?.set;
    if (!descriptor || !originalSet) return;

    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      ...descriptor,
      set(value: string) {
        if (typeof value === 'string' && value.startsWith(scheme)) {
          (window as unknown as { __e2eDeepLink?: string }).__e2eDeepLink = value;
        }
        originalSet.call(this, value);
      },
    });
  }, DEEPLINK_SCHEME);
}

/** Reads the deeplink recorded by `captureDeepLink`, or `undefined` if the dapp has not fired it. */
export function readDeepLink(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as unknown as { __e2eDeepLink?: string }).__e2eDeepLink);
}

/** Asserts the dapp resolved the identity against the testnet backend. */
export type AuthApiGuard = { assertTestnetBackend: () => void };

/** Watches the dapp's auth-api traffic for `assertTestnetBackend`. */
export function watchAuthApi(page: Page): AuthApiGuard {
  const testnetCalls: string[] = [];
  const mainnetCalls: string[] = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes(TESTNET_AUTH_API)) testnetCalls.push(url);
    else if (url.includes(MAINNET_AUTH_API)) mainnetCalls.push(url);
  });

  return {
    assertTestnetBackend() {
      if (mainnetCalls.length > 0) {
        throw new Error(
          `e2e: the auth dapp used ${MAINNET_AUTH_API} (${mainnetCalls.length} call(s), first: ${mainnetCalls[0]}) — the identity it stored cannot be fetched by an app started with --env=dev`,
        );
      }
      if (testnetCalls.length === 0) {
        throw new Error(`e2e: the auth dapp never called ${TESTNET_AUTH_API}`);
      }
    },
  };
}
