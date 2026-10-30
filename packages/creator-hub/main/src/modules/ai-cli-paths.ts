// Managed-CLI paths + sign-in state for AI sign-in without a pre-installed CLI (#1531).
//
// Split out from ai-cli.ts (the install/login machinery) so ai.ts can consult the managed
// bin dir + signed-in marker WITHOUT dragging the heavy imports (npm/bin → app.getAppPath,
// node-pty, electron shell) into ai.ts's import graph — which its pure-function unit tests
// load. This module only touches fs, path, and the (lazy) userData path.
import fs from 'node:fs';
import path from 'node:path';
import log from 'electron-log/main';

import type { AiProvider } from '/shared/types/ai';
import type { AiCliState } from '/shared/types/ipc';

import { getUserDataPath } from './electron';

export type CliSpec = {
  /** npm package that ships the CLI. */
  pkg: string;
  /** binary name npm links into node_modules/.bin. */
  bin: string;
  /** args that drive an interactive subscription login (browser OAuth), storing creds in
   *  the CLI's standard location so a later `-p` turn reads them via the inherited HOME. */
  loginArgs: string[];
  /** Whether the app installs this CLI on demand and drives its login (#1531). When false,
   *  the UI shows terminal install and sign-in steps instead, and a managed binary is ignored. */
  managedSignIn: boolean;
  /** args that make the CLI report its own sign-in state, exiting non-zero when signed out.
   *  When set, this — not the app's marker — decides whether the agent is signed in, so missing
   *  credentials (never signed in, signed out elsewhere) stop reading as connected. It reads only
   *  the local credential store: an expired or revoked token still reports signed in, and is
   *  caught when a turn fails with a 401 (`needsLogin`). */
  statusArgs?: string[];
  /** What the status command prints, alongside a non-zero exit, when signed out. Anything else
   *  (an older CLI without the command, a crash) leaves the agent usable. */
  signedOutPattern?: RegExp;
  /** args that remove the CLI's stored sign-in; needed wherever `statusArgs` is set, since
   *  clearing only the marker would leave the CLI reporting itself signed in. */
  logoutArgs?: string[];
  /** What a login prints when the sign-in failed; the match is shown to the user. Checked anywhere
   *  in a line, since it can follow a prompt that ends without a newline. */
  loginFailedPattern?: RegExp;
  /** Whether the login also accepts a code pasted at its prompt, for when the browser can't
   *  hand the sign-in back to the CLI on its own. */
  acceptsPastedCode?: boolean;
  /** The package's own postinstall, run after every npm run (which skips install scripts), when
   *  the binary npm links is a placeholder until that script puts the native one in its place. */
  setupScript?: string;
};

export const CLI_SPECS: Record<AiProvider, CliSpec> = {
  claude: {
    pkg: '@anthropic-ai/claude-code',
    bin: 'claude',
    loginArgs: ['auth', 'login', '--claudeai'],
    managedSignIn: true,
    statusArgs: ['auth', 'status'],
    signedOutPattern: /"loggedIn":\s*false/,
    logoutArgs: ['auth', 'logout'],
    // A rejected code prints this and sometimes waits forever instead of exiting.
    loginFailedPattern: /Login failed:.*/,
    acceptsPastedCode: true,
    setupScript: 'install.cjs',
  },
  codex: {
    pkg: '@openai/codex',
    bin: 'codex',
    loginArgs: ['login'],
    managedSignIn: true,
    statusArgs: ['login', 'status'],
    signedOutPattern: /not logged in/i,
    logoutArgs: ['logout'],
  },
  cursor: { pkg: 'cursor-agent', bin: 'cursor-agent', loginArgs: ['login'], managedSignIn: false },
  gemini: { pkg: '@google/gemini-cli', bin: 'gemini', loginArgs: [], managedSignIn: false },
};

const MANAGED_DIRNAME = 'ai-cli';

/** The isolated npm project the managed CLIs install into (outside the CH repo, so npm
 *  never traverses up into the workspace). */
export function getManagedCliDir(): string {
  return path.join(getUserDataPath(), MANAGED_DIRNAME);
}

/** node_modules/.bin of the managed project — added to ai.ts's searchDirs() so a managed
 *  CLI resolves like a PATH install. A STATIC path: safe to keep in the search list even
 *  before anything is installed (findExecutable just misses until it exists). */
export function getManagedBinDir(): string {
  return path.join(getManagedCliDir(), 'node_modules', '.bin');
}

export function managedBinPath(provider: AiProvider): string {
  const bin = CLI_SPECS[provider].bin;
  // On Windows npm links the CLI as `<bin>.cmd` (plus a `.ps1` and an extensionless POSIX
  // shebang script that is NOT a runnable PE). The `.cmd` shim is the one to spawn — handing
  // the bare name to CreateProcess fails with ERROR_BAD_EXE_FORMAT (exit 193).
  const name = process.platform === 'win32' ? `${bin}.cmd` : bin;
  return path.join(getManagedBinDir(), name);
}

/** Is this provider's CLI installed in the managed dir? (existsSync follows the .bin symlink). */
export function isInstalled(provider: AiProvider): boolean {
  return fs.existsSync(managedBinPath(provider));
}

// --- signed-in marker -----------------------------------------------------------------
// We can't reliably detect a CLI's logged-in state cross-platform (creds live in the OS
// keychain on macOS, a dotfile elsewhere), so we record a marker when OUR login flow
// succeeds and clear it on sign-out. `available` for a managed CLI gates on this (a freshly
// installed CLI isn't logged in yet). A turn that later hits an auth error is surfaced to
// the user, who can sign in again.
type ManagedState = { signedIn: Partial<Record<AiProvider, boolean>> };

function stateFile(): string {
  return path.join(getManagedCliDir(), 'state.json');
}

function readState(): ManagedState {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return { signedIn: parsed?.signedIn ?? {} };
  } catch {
    return { signedIn: {} };
  }
}

export function setSignedIn(provider: AiProvider, value: boolean): void {
  const state = readState();
  if (value) state.signedIn[provider] = true;
  else delete state.signedIn[provider];
  try {
    fs.mkdirSync(getManagedCliDir(), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch (e) {
    log.warn('[AI-CLI] could not persist sign-in state:', e);
  }
}

export function isSignedIn(provider: AiProvider): boolean {
  return isInstalled(provider) && readState().signedIn[provider] === true;
}

export function getCliState(): AiCliState {
  const providers = Object.keys(CLI_SPECS) as AiProvider[];
  return Object.fromEntries(
    providers.map(id => [id, { installed: isInstalled(id), signedIn: isSignedIn(id) }]),
  ) as AiCliState;
}
