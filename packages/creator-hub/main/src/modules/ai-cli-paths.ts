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
};

export const CLI_SPECS: Record<AiProvider, CliSpec> = {
  claude: { pkg: '@anthropic-ai/claude-code', bin: 'claude', loginArgs: ['setup-token'] },
  codex: { pkg: '@openai/codex', bin: 'codex', loginArgs: ['login'] },
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
  return {
    claude: { installed: isInstalled('claude'), signedIn: isSignedIn('claude') },
    codex: { installed: isInstalled('codex'), signedIn: isSignedIn('codex') },
  };
}
