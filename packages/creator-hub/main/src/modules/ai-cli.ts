// AI sign-in without a pre-installed CLI (#1531) — install + login machinery.
//
// The raw-spawn providers in ai.ts require the user to already have `claude`/`codex` on
// their PATH and logged in. Many target users have a Claude/ChatGPT subscription but never
// touched a CLI. For them we install the OFFICIAL CLI on demand into an app-managed dir
// (using the Node + npm Creator Hub already bundles — the same infra that installs scene
// deps) and drive the CLI's own subscription login. We deliberately do NOT bundle the
// binary into the app: that would add tens of MB per arch and pull a native binary into
// macOS notarization; installing on demand keeps the app lean and uses the official,
// maintained tool with its official OAuth (no ToS gray-zone, no third-party agent).
//
// The managed bin dir (see ai-cli-paths) is added to ai.ts's `searchDirs()`, so once
// installed the CLI is found by `detectProviders()`/`findExecutable()` and spawned by
// `aiSend` exactly like a user-PATH install — the turn child inherits HOME and reads the
// credentials the login stored, the same subscription-billing model ai.ts already relies on.
//
// The light path/state helpers live in ai-cli-paths so ai.ts can consult them without
// pulling these heavy imports (npm/pty/electron-shell) into its unit-test graph.
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as pty from 'node-pty';
import { shell } from 'electron';
import log from 'electron-log/main';

import type { AiProvider } from '/shared/types/ai';
import { AI_CLI_LOGIN_EVENTS, type AiCliLoginEvent } from '/shared/types/ipc';

import { MAIN_WINDOW_ID } from '../mainWindow';
import {
  CLI_SPECS,
  getManagedCliDir,
  isInstalled,
  managedBinPath,
  setSignedIn,
} from './ai-cli-paths';
import { install as npmInstall } from './npm';
import { getBundledNodePath } from './path';
import { getWindow } from './window';

export { getCliState } from './ai-cli-paths';

// --- install --------------------------------------------------------------------------

async function ensureInstalled(
  provider: AiProvider,
  onProgress: (message: string) => void,
): Promise<void> {
  if (isInstalled(provider)) return;
  const dir = getManagedCliDir();
  await fsp.mkdir(dir, { recursive: true });
  // Seed a private package.json so npm treats this as its own project (it won't walk up
  // into the Creator Hub workspace) and won't warn about a missing manifest.
  const manifest = path.join(dir, 'package.json');
  try {
    await fsp.access(manifest);
  } catch {
    await fsp.writeFile(
      manifest,
      `${JSON.stringify({ name: 'creator-hub-ai-cli', private: true, version: '1.0.0' }, null, 2)}\n`,
    );
  }
  const { pkg, bin } = CLI_SPECS[provider];
  onProgress(`Installing ${pkg}…`);
  log.info(`[AI-CLI] installing ${pkg} into ${dir}`);
  // The shared npm helper runs the bundled npm/Node with --save-exact in cwd=dir.
  await npmInstall(dir, [`${pkg}@latest`]);
  if (!isInstalled(provider)) {
    throw new Error(`Install of ${pkg} did not produce a "${bin}" binary`);
  }
  onProgress('Installed.');
}

// --- login ----------------------------------------------------------------------------

function sendLoginEvent(event: AiCliLoginEvent): void {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win && !win.isDestroyed()) win.webContents.send(AI_CLI_LOGIN_EVENTS, event);
}

// Env for the login child: inherit the user's environment (HOME/keychain, so the CLI can
// store its credentials where a later turn reads them) and widen PATH with the bundled
// Node's dir so a JS-shebang CLI (codex) can resolve `node`.
function loginEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  const nodePath = getBundledNodePath();
  if (nodePath) {
    env.PATH = [path.dirname(nodePath), env.PATH ?? ''].filter(Boolean).join(path.delimiter);
  }
  return env;
}

// Strip ANSI escape/control sequences from PTY output so URL detection and the progress
// text we surface aren't polluted by cursor moves and colors.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;?]*[A-Za-z]|\u009b[0-9;?]*[A-Za-z]/g;
const URL_RE = /(https?:\/\/[^\s'"]+)/;

let activeLogin: pty.IPty | null = null;

// The official CLIs' subscription login (`claude setup-token` / `codex login`) is
// terminal-interactive — it does nothing over a plain pipe — so we run it in a real PTY
// (node-pty). It opens a browser (or prints a URL, which we open) and completes via a
// localhost OAuth callback, storing credentials where a later `-p` turn reads them via the
// inherited HOME. We surface the URL and streamed lines to the setup panel and treat a
// clean exit as success.
//
// NOTE (needs live verification with a real subscription — no test account here): if a
// flow turns out to prompt for a pasted code instead of a pure browser-callback, we'd wire
// that prompt to `activeLogin.write(...)`; the PTY makes that possible without more infra.
async function login(provider: AiProvider, onProgress: (message: string) => void): Promise<void> {
  if (activeLogin) throw new Error('Another sign-in is already in progress');
  const spec = CLI_SPECS[provider];
  const bin = managedBinPath(provider);
  onProgress('Starting sign-in…');

  await new Promise<void>((resolve, reject) => {
    let child: pty.IPty;
    try {
      child = pty.spawn(bin, spec.loginArgs, {
        name: 'xterm-color',
        cols: 120,
        rows: 40,
        cwd: getManagedCliDir(),
        env: loginEnv(),
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    activeLogin = child;
    let urlOpened = false;
    let buffer = '';
    child.onData(data => {
      // A cancelled/superseded login keeps streaming until its process actually exits; drop
      // its output so it can't emit progress into the panel of whatever login is current now.
      if (activeLogin !== child) return;
      buffer += data.replace(ANSI_RE, '');
      // Emit whole lines; keep the trailing partial for the next chunk.
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const text = line.trim();
        if (text === '') continue;
        const url = URL_RE.exec(text)?.[1];
        if (url && !urlOpened) {
          urlOpened = true;
          sendLoginEvent({ type: 'auth', url });
          void shell.openExternal(url);
        } else {
          sendLoginEvent({ type: 'progress', message: text });
        }
      }
    });
    child.onExit(({ exitCode }) => {
      // Only clear the shared ref if it still points at us — a late exit from a cancelled
      // login must not stomp a newer one the user already started.
      if (activeLogin === child) activeLogin = null;
      if (exitCode === 0) resolve();
      else reject(new Error(`${spec.pkg} sign-in exited with code ${exitCode}`));
    });
  });
}

export async function signInCli(provider: AiProvider): Promise<void> {
  const onProgress = (message: string) => sendLoginEvent({ type: 'progress', message });
  await ensureInstalled(provider, onProgress);
  await login(provider, onProgress);
  setSignedIn(provider, true);
  log.info(`[AI-CLI] signed in to ${provider} (managed CLI)`);
}

const SIGKILL_ESCALATION_MS = 2000;

export async function cancelSignInCli(): Promise<void> {
  const child = activeLogin;
  if (!child) return;
  activeLogin = null;
  log.info('[AI-CLI] cancelling sign-in');
  try {
    child.kill('SIGTERM');
  } catch {
    return; // already gone
  }
  // Escalate to SIGKILL if the login ignores the polite signal (e.g. stuck mid-OAuth), so a
  // hung CLI can't linger until the app quits. Cleared as soon as it exits on its own.
  const escalate = setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }, SIGKILL_ESCALATION_MS);
  escalate.unref?.();
  child.onExit(() => clearTimeout(escalate));
}

export async function signOutCli(provider: AiProvider): Promise<void> {
  setSignedIn(provider, false);
  log.info(`[AI-CLI] signed out of ${provider} (managed CLI)`);
}
