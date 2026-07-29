import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { ElectronApplication } from 'playwright';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the creator-hub package root (where the built app lives). */
export const creatorHubDir = join(__dirname, '..', '..');

/**
 * Resolves the packaged app's executable inside `dist/`.
 *
 * The suite drives the packaged artifact rather than `electron .` so that
 * `APP_UNPACKED_PATH` (`main/src/modules/path.ts`) resolves against a real
 * `Contents/Resources/app.asar.unpacked`, which is what keeps a test-only
 * `process.env.E2E` branch out of production source.
 *
 * Walked rather than concatenated: `productName` is "Decentraland Creator Hub", so every
 * path component contains spaces, and the arch suffix (`mac-arm64` vs `mac`) is not
 * knowable ahead of time.
 */
export function resolvePackagedApp(): string {
  const distRoot = join(creatorHubDir, 'dist');
  const hint = 'run `npm run compile` in packages/creator-hub first';

  if (!existsSync(distRoot)) throw new Error(`e2e: no ${distRoot} — ${hint}`);

  for (const macDir of readdirSync(distRoot).filter(entry => entry.startsWith('mac'))) {
    const bundle = readdirSync(join(distRoot, macDir)).find(entry => entry.endsWith('.app'));
    if (!bundle) continue;
    const macOsDir = join(distRoot, macDir, bundle, 'Contents', 'MacOS');
    if (!existsSync(macOsDir)) continue;
    const [executable] = readdirSync(macOsDir);
    if (executable) return join(macOsDir, executable);
  }

  throw new Error(`e2e: no .app/Contents/MacOS/<binary> under ${distRoot} — ${hint}`);
}

/**
 * A launched app together with the throwaway directories it was given. Callers must
 * `cleanup()` in their teardown.
 */
export type LaunchedApp = {
  electronApp: ElectronApplication;
  /** Removes the throwaway user-data and home directories. Safe to call more than once. */
  cleanup: () => void;
};

/**
 * Cold-launching Electron is the slowest, most run-to-run-variable step on a contended
 * CI runner. Retry a couple of times so a single spawn/CDP-connect hiccup doesn't fail
 * the whole suite. `timeout` is Playwright's own launch timeout (default 30s).
 *
 * Each launch gets a fresh, throwaway `--user-data-dir` **and** a fresh `HOME`:
 *   - `--user-data-dir` keeps a persisted sign-in identity from leaking in, which would
 *     start the app already logged in and break any logged-out precondition.
 *   - `HOME` is redirected because scene projects are created under the user's home;
 *     without it a scene-lifecycle test writes into the developer's real home directory.
 *     Electron derives `app.getPath('home')` from `$HOME`, so passing it here replaces
 *     the `app.setPath('home', ...)` call a test-only main-process branch would need.
 */
export async function launchApp(attempts = 3): Promise<LaunchedApp> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'creator-hub-e2e-data-'));
  const homeDir = mkdtempSync(join(tmpdir(), 'creator-hub-e2e-home-'));

  const cleanup = () => {
    for (const dir of [userDataDir, homeDir]) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors — the OS reclaims the temp dir eventually
      }
    }
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const electronApp = await electron.launch({
        executablePath: resolvePackagedApp(),
        // No `args: ['.']` and no `cwd`: a packaged app resolves its own resources.
        args: [`--user-data-dir=${userDataDir}`],
        env: {
          ...process.env,
          HOME: homeDir,
          // The app runs its scene preview server on this port.
          PORT: '3001',
        },
        timeout: 60_000,
      });
      return { electronApp, cleanup };
    } catch (error) {
      lastError = error;
      console.warn(`[e2e] Electron launch attempt ${attempt}/${attempts} failed:`, error);
    }
  }

  cleanup();
  throw lastError;
}
