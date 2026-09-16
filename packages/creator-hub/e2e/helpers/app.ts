import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
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
  const override = process.env.E2E_APP_PATH;
  if (override) {
    const bundle = resolve(override);
    if (!existsSync(bundle)) throw new Error(`e2e: E2E_APP_PATH does not exist: ${bundle}`);
    if (!bundle.endsWith('.app')) return bundle;

    const macOsDir = join(bundle, 'Contents', 'MacOS');
    if (!existsSync(macOsDir)) throw new Error(`e2e: not an app bundle, no ${macOsDir}`);
    return join(macOsDir, readdirSync(macOsDir)[0]);
  }

  const distRoot = join(creatorHubDir, 'dist');
  const hint = 'run `npm run compile` in packages/creator-hub first, or set E2E_APP_PATH';

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
  /** The throwaway `--user-data-dir`. Scenes are created under `<userData>/Scenes`
   *  (`getDefaultScenesPath`), so filesystem assertions about a scene resolve from here —
   *  not from HOME, which only backs the legacy `.decentraland` path. */
  userDataDir: string;
  /** Removes the throwaway user-data and home directories. Safe to call more than once. */
  cleanup: () => void;
};

/**
 * Cold-launching Electron is the slowest, most run-to-run-variable step on a contended
 * CI runner. Retry a couple of times so a single spawn/CDP-connect hiccup doesn't fail
 * the whole suite. `timeout` is Playwright's own launch timeout (default 30s).
 *
 * Each launch gets a fresh, throwaway `--user-data-dir` **and** a fresh `HOME`:
 *   - `--user-data-dir` is what isolates real work: it keeps a persisted sign-in identity
 *     from leaking in (which would start the app already logged in), and scenes are created
 *     under `<userData>/Scenes` per `getDefaultScenesPath`, so a scene test cannot touch the
 *     developer's own projects.
 *   - `HOME` is redirected for the legacy `.decentraland` path (`getAppHomeLegacy`). Electron
 *     derives `app.getPath('home')` from `$HOME`, so passing it here avoids needing a
 *     test-only `app.setPath('home', ...)` branch in the main process.
 */
export async function launchApp(
  options: { attempts?: number; extraArgs?: string[] } = {},
): Promise<LaunchedApp> {
  const { attempts = 3, extraArgs = [] } = options;
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
        args: [`--user-data-dir=${userDataDir}`, ...extraArgs],
        env: {
          ...process.env,
          HOME: homeDir,
          // The app runs its scene preview server on this port.
          PORT: '3001',
        },
        timeout: 60_000,
      });
      return { electronApp, userDataDir, cleanup };
    } catch (error) {
      lastError = error;
      console.warn(`[e2e] Electron launch attempt ${attempt}/${attempts} failed:`, error);
    }
  }

  cleanup();
  throw lastError;
}
