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
import crossSpawn from 'cross-spawn';
import log from 'electron-log/main';

import { AI_CLI_COMMANDS, apiKeyAlternative, type AiProvider } from '/shared/types/ai';
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
import { APP_UNPACKED_PATH } from './path';
import { getChildEnv, resolveNodeRuntime } from './node-runtime';
import { getWindow } from './window';

export { getCliState } from './ai-cli-paths';

// --- install --------------------------------------------------------------------------

// Every npm run in the managed folder goes through this chain: two at once in the same folder
// trip over each other, and a turn or a recheck waits on it (see whenManagedCliIdle).
let npmQueue: Promise<void> = Promise.resolve();

function enqueueNpm(work: () => Promise<void>): Promise<void> {
  const run = npmQueue.then(work);
  npmQueue = run.catch(() => {});
  return run;
}

/** Resolves once no npm run is touching the managed CLIs. npm removes the old binary before it
 *  links the new one, so a turn or a scan started mid-update finds no CLI. */
export function whenManagedCliIdle(): Promise<void> {
  return npmQueue;
}

// Install scripts are off: the official CLIs ship their native binary as an optional
// dependency, so a script appearing in a release is not ours to run. The one exception is a
// CLI's own known setup step (`setupScript`), run by name after npm finishes.
const NPM_OPTIONS = { ignoreScripts: true };

const SETUP_TIMEOUT_MS = 60_000;

/** Run the package's own postinstall with the bundled Node, e.g. Claude's, which puts the native
 *  binary (already downloaded as an optional dependency) in place of the placeholder npm links. */
function runSetupScript(provider: AiProvider): Promise<void> {
  const { pkg, setupScript } = CLI_SPECS[provider];
  if (setupScript === undefined) return Promise.resolve();
  const pkgDir = path.join(getManagedCliDir(), 'node_modules', pkg);
  const runtime = resolveNodeRuntime();
  return new Promise((resolve, reject) => {
    const child = crossSpawn(runtime.node, [path.join(pkgDir, setupScript)], {
      cwd: pkgDir,
      env: getChildEnv(runtime),
      stdio: 'ignore',
    });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${pkg} setup timed out`));
    }, SETUP_TIMEOUT_MS);
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`${pkg} setup failed (exit code ${code})`));
    });
  });
}

// An install that is never updated falls behind the user's shared ~/.codex/config.toml, which a
// newer Codex (desktop app, IDE extension, terminal install) may point at a model the old CLI
// can't use — every turn then fails while the agent shows as connected.
const updatedThisRun = new Set<AiProvider>();

function update(provider: AiProvider, onProgress: (message: string) => void): Promise<void> {
  updatedThisRun.add(provider);
  return enqueueNpm(async () => {
    const { pkg } = CLI_SPECS[provider];
    onProgress(`Updating ${pkg}…`);
    try {
      await npmInstall(getManagedCliDir(), [`${pkg}@latest`], NPM_OPTIONS);
    } catch (error) {
      // Offline, or Windows holding the binary open: the installed copy still works.
      log.warn(`[AI-CLI] could not update ${pkg}, keeping the installed version:`, error);
    }
    // Also after a failed npm run, which may have left the placeholder in place.
    try {
      await runSetupScript(provider);
    } catch (error) {
      log.warn(`[AI-CLI] could not set up ${pkg} after updating:`, error);
    }
  });
}

/** Update every app-installed CLI once per app run, so a long-lived install keeps up. */
export async function updateManagedClis(): Promise<void> {
  for (const provider of Object.keys(CLI_SPECS) as AiProvider[]) {
    if (!CLI_SPECS[provider].managedSignIn || !isInstalled(provider)) continue;
    if (updatedThisRun.has(provider)) continue;
    await update(provider, message => log.info(`[AI-CLI] ${message}`));
  }
}

let turnsStarting = 0;

/** Start a turn once no npm run is replacing a CLI, and keep updates from starting meanwhile. */
export async function startTurnWhenIdle<T>(startTurn: () => Promise<T>): Promise<T> {
  turnsStarting++;
  try {
    await whenManagedCliIdle();
    return await startTurn();
  } finally {
    turnsStarting--;
  }
}

/** Scan once any running update is done, then update in the background unless a turn is
 *  starting or running. Scanning first keeps the update from hiding the binary mid-scan. */
export async function detectThenUpdate<T>(
  detect: () => Promise<T>,
  turnRunning: () => boolean,
): Promise<T> {
  await whenManagedCliIdle();
  const result = await detect();
  if (turnsStarting === 0 && !turnRunning()) void updateManagedClis();
  return result;
}

function install(provider: AiProvider, onProgress: (message: string) => void): Promise<void> {
  updatedThisRun.add(provider);
  return enqueueNpm(async () => {
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
    await npmInstall(dir, [`${pkg}@latest`], NPM_OPTIONS);
    await runSetupScript(provider);
    if (!isInstalled(provider)) {
      throw new Error(`Install of ${pkg} did not produce a "${bin}" binary`);
    }
    onProgress('Installed.');
  });
}

// --- login ----------------------------------------------------------------------------

function sendLoginEvent(event: AiCliLoginEvent): void {
  const win = getWindow(MAIN_WINDOW_ID);
  if (win && !win.isDestroyed()) win.webContents.send(AI_CLI_LOGIN_EVENTS, event);
}

function loginEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(getChildEnv(resolveNodeRuntime()))) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

// Strip ANSI escape/control sequences from PTY output so URL detection and the progress
// text we surface aren't polluted by cursor moves, colors, and terminal hyperlinks (claude wraps
// its sign-in URL in one, which otherwise glues the link target onto the visible URL).
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\u001b\[[0-9;?]*[A-Za-z]|\u009b[0-9;?]*[A-Za-z]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
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
let signInCancelled = false;

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

// The official CLIs' subscription login (`claude auth login` / `codex login`) is
// terminal-interactive — it does nothing over a plain pipe — so we run it in a real PTY
// (node-pty). The CLI opens its OWN browser tab and completes via a localhost OAuth callback,
// storing credentials where a later `-p` turn reads them via the inherited HOME. We surface
// the URL (as a manual fallback) and the streamed lines to the setup panel, but deliberately
// do not open the browser ourselves — a second tab double-redeems the one-time code and fails
// the login. A clean exit is treated as success.
//
// Claude's fallback URL is a different flow: it redirects to Anthropic's own page, which shows
// a code the user pastes back at the CLI's prompt (`acceptsPastedCode`, see submitSignInCode).
async function login(provider: AiProvider, onProgress: (message: string) => void): Promise<void> {
  if (activeLogin) throw new Error('Another sign-in is already in progress');
  const spec = CLI_SPECS[provider];
  const bin = managedBinPath(provider);
  ensureSpawnHelperExecutable();
  onProgress('Starting sign-in…');

  // On Windows `bin` is a `.cmd` shim, which ConPTY can't launch directly (CreateProcess only
  // runs a real PE) — run it through the command interpreter. The login args are fixed tokens
  // (`auth login --claudeai` / `login`), so there's no argument-escaping concern here.
  const [file, args]: [string, string[]] =
    process.platform === 'win32'
      ? [process.env.ComSpec ?? 'cmd.exe', ['/c', bin, ...spec.loginArgs]]
      : [bin, spec.loginArgs];

  await new Promise<void>((resolve, reject) => {
    let child: pty.IPty;
    try {
      child = pty.spawn(file, args, {
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
        const failure = spec.loginFailedPattern?.exec(text);
        if (url !== null) {
          authUrlSent = true;
          sendLoginEvent({ type: 'auth', url, acceptsCode: spec.acceptsPastedCode === true });
        } else if (failure != null) {
          clearTimeout(timeout);
          activeLogin = null;
          killLogin(child);
          reject(new Error(failure[0]));
          return;
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
  if (!CLI_SPECS[provider].managedSignIn) {
    throw new Error(
      `${provider} signs in from its own CLI. Run \`${AI_CLI_COMMANDS[provider].signin}\` in a terminal (or ${apiKeyAlternative(provider)}), then click Recheck.`,
    );
  }
  const onProgress = (message: string) => sendLoginEvent({ type: 'progress', message });
  signInCancelled = false;
  // Skip the update when this run already did one: a second npm run only delays the browser.
  if (!isInstalled(provider)) await install(provider, onProgress);
  else if (!updatedThisRun.has(provider)) await update(provider, onProgress);
  else await whenManagedCliIdle();
  // Cancel can't stop npm (there is no login to kill yet), so honour it before the login starts.
  if (signInCancelled) throw new Error('Sign-in cancelled');
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

/** Type the code the provider's page showed at the running login's prompt. */
export async function submitSignInCode(code: string): Promise<void> {
  if (!activeLogin) throw new Error('No sign-in is in progress');
  // The code has no spaces; a newline or control key inside the paste would act on the prompt.
  const line = code.replace(/[\s\p{Cc}]+/gu, '');
  if (line === '') return;
  activeLogin.write(`${line}\r`);
}

export async function cancelSignInCli(): Promise<void> {
  signInCancelled = true;
  const child = activeLogin;
  if (!child) return;
  activeLogin = null;
  log.info('[AI-CLI] cancelling sign-in');
  killLogin(child);
}

const LOGOUT_TIMEOUT_MS = 15_000;

function runLogout(provider: AiProvider, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = crossSpawn(managedBinPath(provider), args, { env: loginEnv(), stdio: 'ignore' });
    // A logout that waits on input it can never get (e.g. a keychain prompt) would hang sign-out.
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${provider} sign-out timed out`));
    }, LOGOUT_TIMEOUT_MS);
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', code => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`${provider} sign-out failed (exit code ${code})`));
    });
  });
}

// The CLI keeps its sign-in in the user's shared config (~/.codex, Claude's keychain entry), so
// this also signs out any other copy of the same CLI on the machine. It has to: with a status
// check deciding "connected", clearing only our marker would leave the agent connected.
export async function signOutCli(provider: AiProvider): Promise<void> {
  const { logoutArgs } = CLI_SPECS[provider];
  if (logoutArgs !== undefined && isInstalled(provider)) {
    await whenManagedCliIdle();
    try {
      await runLogout(provider, logoutArgs);
    } catch (error) {
      log.warn(`[AI-CLI] ${provider} sign-out failed:`, error);
      throw error;
    }
  }
  setSignedIn(provider, false);
  log.info(`[AI-CLI] signed out of ${provider} (managed CLI)`);
}
