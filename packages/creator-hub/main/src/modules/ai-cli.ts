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
// pulling these heavy imports (npm/pty) into its unit-test graph.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as pty from 'node-pty';
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
import { APP_UNPACKED_PATH, getBundledNodePath } from './path';
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
const URL_RE = /(https?:\/\/[^\s'"]+)/g;

// Pull the *sign-in* URL out of a CLI line — the remote page the user must open. Two traps:
//  - trailing sentence punctuation gets captured too (codex prints "…server on http://…:1455."),
//    so a greedy match yields an unparseable URL; trim it.
//  - the CLI also prints its own loopback callback server (127.0.0.1/localhost). That's NOT the
//    page to open; skip it so we don't hijack the first match and miss the real auth URL.
function extractAuthUrl(text: string): string | null {
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    const candidate = match[1].replace(/[.,;:!?)\]}'"]+$/, '');
    let host: string;
    try {
      host = new URL(candidate).hostname;
    } catch {
      continue; // not a real URL (truncated/garbled) — keep scanning
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') continue;
    return candidate;
  }
  return null;
}

let activeLogin: pty.IPty | null = null;

// Auto-kill a sign-in that never completes, so a hung login (provider OAuth failing, user
// walked away) can't wedge activeLogin. Generous enough for an unhurried browser SSO; codex's
// own device code, for reference, expires at 15m.
const LOGIN_TIMEOUT_MS = 5 * 60_000;

// node-pty execs its bundled `spawn-helper` binary (via posix_spawn) as the FIRST step of
// every spawn, before it ever reaches our command — so if that helper isn't executable, the
// spawn dies with a bare "posix_spawnp failed" regardless of what we're launching. node-pty
// 1.1.0's darwin prebuild ships spawn-helper as 0644 (its post-install only fixes a source
// `build/Release`, never the `prebuilds/` we load from), and electron-builder copies that
// mode verbatim, so both `npm start` and the packaged app hit it. Add the exec bit before
// the first login. Best-effort: a read-only install is covered by the build-time after-pack.
let spawnHelperEnsured = false;
function ensureSpawnHelperExecutable(): void {
  if (spawnHelperEnsured || process.platform === 'win32') return;
  spawnHelperEnsured = true;
  // Same dir node-pty loads the binding from: <node-pty>/prebuilds/<platform>-<arch>. Also
  // try build/Release in case a source build is ever used. APP_UNPACKED_PATH already resolves
  // dev (hoisted node_modules) vs packaged (app.asar.unpacked).
  const root = path.join(APP_UNPACKED_PATH, 'node_modules', 'node-pty');
  const candidates = [
    path.join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
    path.join(root, 'build', 'Release', 'spawn-helper'),
  ];
  for (const helper of candidates) {
    try {
      const { mode } = fs.statSync(helper);
      if ((mode & 0o111) === 0) {
        fs.chmodSync(helper, mode | 0o111);
        log.info(`[AI-CLI] marked node-pty spawn-helper executable: ${helper}`);
      }
    } catch {
      /* not this candidate, or not writable — the build-time hook is the fallback */
    }
  }
}

// The official CLIs' subscription login (`claude setup-token` / `codex login`) is
// terminal-interactive — it does nothing over a plain pipe — so we run it in a real PTY
// (node-pty). The CLI opens its OWN browser tab and completes via a localhost OAuth callback,
// storing credentials where a later `-p` turn reads them via the inherited HOME. We surface
// the URL (as a manual fallback) and the streamed lines to the setup panel, but deliberately
// do not open the browser ourselves — a second tab double-redeems the one-time code and fails
// the login. A clean exit is treated as success.
//
// NOTE (needs live verification with a real subscription — no test account here): if a
// flow turns out to prompt for a pasted code instead of a pure browser-callback, we'd wire
// that prompt to `activeLogin.write(...)`; the PTY makes that possible without more infra.
async function login(provider: AiProvider, onProgress: (message: string) => void): Promise<void> {
  if (activeLogin) throw new Error('Another sign-in is already in progress');
  const spec = CLI_SPECS[provider];
  const bin = managedBinPath(provider);
  ensureSpawnHelperExecutable();
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
    // A login the user never finishes (e.g. the provider's OAuth is failing server-side, so the
    // CLI waits on a callback that never comes) would keep its PTY alive forever — wedging
    // activeLogin so every retry throws "Another sign-in is already in progress". Cap it: kill a
    // login that hasn't exited within LOGIN_TIMEOUT_MS and reject so the panel resets to idle.
    const timeout = setTimeout(() => {
      if (activeLogin !== child) return; // already resolved / cancelled / superseded
      activeLogin = null;
      log.warn(`[AI-CLI] ${spec.pkg} sign-in timed out after ${LOGIN_TIMEOUT_MS}ms; killing`);
      killLogin(child);
      reject(new Error(`${spec.pkg} sign-in timed out. Please try again.`));
    }, LOGIN_TIMEOUT_MS);
    timeout.unref?.();
    let authUrlSent = false;
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
        // Surface the auth URL to the panel, but DON'T open it ourselves: the CLIs open their
        // own browser tab (their "if your browser didn't open…" line is the tell). A second tab
        // from us means two one-time auth codes hitting the CLI's localhost callback, and the
        // duplicate redeem fails the whole login (codex: "token_exchange_failed"). The panel
        // shows the URL as the manual fallback for when the CLI's own open doesn't fire.
        const url = authUrlSent ? null : extractAuthUrl(text);
        if (url !== null) {
          authUrlSent = true;
          sendLoginEvent({ type: 'auth', url });
        } else {
          sendLoginEvent({ type: 'progress', message: text });
        }
      }
    });
    child.onExit(({ exitCode }) => {
      clearTimeout(timeout);
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

// SIGTERM the login PTY, escalating to SIGKILL if it ignores the polite signal — a login stuck
// mid-OAuth won't exit on its own. Safe to call on an already-dead child.
function killLogin(child: pty.IPty): void {
  try {
    child.kill('SIGTERM');
  } catch {
    return; // already gone
  }
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

export async function cancelSignInCli(): Promise<void> {
  const child = activeLogin;
  if (!child) return;
  activeLogin = null;
  log.info('[AI-CLI] cancelling sign-in');
  killLogin(child);
}

export async function signOutCli(provider: AiProvider): Promise<void> {
  setSignedIn(provider, false);
  log.info(`[AI-CLI] signed out of ${provider} (managed CLI)`);
}
