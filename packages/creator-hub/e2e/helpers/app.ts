import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { ElectronApplication } from 'playwright';
import { _electron as electron } from 'playwright';

const electronPath = require('electron') as string;
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the creator-hub package root (where the built app lives). */
export const creatorHubDir = join(__dirname, '..', '..');

/**
 * A launched app together with the throwaway user-data directory it was given.
 * Callers must `cleanup()` in their teardown to remove the temp directory.
 */
export type LaunchedApp = {
  electronApp: ElectronApplication;
  /** Removes the throwaway user-data directory. Safe to call more than once. */
  cleanup: () => void;
};

/**
 * Cold-launching Electron is the slowest, most run-to-run-variable step on a
 * contended CI runner. Retry a couple of times so a single spawn/CDP-connect
 * hiccup doesn't fail the whole suite. `timeout` is Playwright's own launch
 * timeout (default 30s); the beforeAll hook gets a larger budget on top.
 *
 * Each launch gets a fresh, throwaway `--user-data-dir` so tests never depend on
 * (or pollute) the developer's real profile — otherwise a persisted sign-in
 * identity leaks in and the app starts already logged in, breaking any test that
 * assumes a logged-out starting state.
 */
export async function launchApp(attempts = 3): Promise<LaunchedApp> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'creator-hub-e2e-'));
  const cleanup = () => {
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors — the OS reclaims the temp dir eventually
    }
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const electronApp = await electron.launch({
        executablePath: electronPath,
        args: ['.', `--user-data-dir=${userDataDir}`],
        cwd: creatorHubDir,
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
