import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { shell } from 'electron';
import log from 'electron-log';

import type { OAuthCredentials, OAuthProviderInterface } from '@mariozechner/pi-ai';

import { AI_AUTH_EVENTS_CHANNEL, type AiAuthEvent, type AiAuthProvider } from '/shared/types/ipc';

import { MAIN_WINDOW_ID } from '../mainWindow';

import { APP_UNPACKED_PATH } from './path';
import { getWindow } from './window';

export const AI_AUTH_PROVIDERS: AiAuthProvider[] = ['anthropic', 'openai-codex', 'github-copilot'];

type PiAiOAuth = {
  getOAuthProvider: (id: string) => OAuthProviderInterface | undefined;
};

type StoredCredential = { type: 'api_key'; key: string } | ({ type: 'oauth' } & OAuthCredentials);

// The `./oauth` subpath is declared in pi-ai's `exports` map, which the main
// tsconfig's Node10 module resolution can't see — hence the opaque specifier
// (types come from the root import above).
const PI_AI_OAUTH_SPECIFIER = '@mariozechner/pi-ai/oauth';

let piAiModule: PiAiOAuth | null = null;

/**
 * Loads @mariozechner/pi-ai (the OAuth implementation used by the opendcl
 * agent). It is a transitive dependency (opendcl → pi-coding-agent → pi-ai),
 * so when the bare import fails we look for it in the node_modules trees the
 * installed opendcl package can see.
 */
async function loadPiAi(): Promise<PiAiOAuth> {
  if (piAiModule) return piAiModule;
  try {
    piAiModule = (await import(/* @vite-ignore */ PI_AI_OAUTH_SPECIFIER)) as PiAiOAuth;
    return piAiModule;
  } catch {
    // Fall through to resolution relative to the opendcl package.
  }
  const scopedPath = path.join('@mariozechner', 'pi-ai', 'dist', 'oauth.js');
  const candidates = [
    path.join(APP_UNPACKED_PATH, 'node_modules', scopedPath),
    path.join(
      APP_UNPACKED_PATH,
      'node_modules',
      '@dcl-regenesislabs',
      'opendcl',
      'node_modules',
      scopedPath,
    ),
    path.join(
      APP_UNPACKED_PATH,
      'node_modules',
      '@dcl-regenesislabs',
      'opendcl',
      'node_modules',
      '@mariozechner',
      'pi-coding-agent',
      'node_modules',
      scopedPath,
    ),
  ];
  for (const candidate of candidates) {
    try {
      await fs.stat(candidate);
      piAiModule = (await import(/* @vite-ignore */ pathToFileURL(candidate).href)) as PiAiOAuth;
      return piAiModule;
    } catch {
      // Try the next location.
    }
  }
  throw new Error('Could not load the OAuth module from the installed opendcl package');
}

/**
 * pi's config dir (credentials, settings, sessions). We keep opendcl's
 * historical `~/.opendcl/agent` location so existing sign-ins survive, and
 * pass it to the spawned agent via PI_CODING_AGENT_DIR — the same env var pi
 * itself honors. Both the OAuth writes here and the agent's reads/refreshes
 * go through this one directory.
 */
export function getPiAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.opendcl', 'agent');
}

function getAuthJsonPath(): string {
  return path.join(getPiAgentDir(), 'auth.json');
}

async function readAuthJson(): Promise<Record<string, StoredCredential>> {
  try {
    return JSON.parse(await fs.readFile(getAuthJsonPath(), 'utf8'));
  } catch {
    return {};
  }
}

async function writeAuthJson(data: Record<string, StoredCredential>): Promise<void> {
  const authPath = getAuthJsonPath();
  await fs.mkdir(path.dirname(authPath), { recursive: true });
  await fs.writeFile(authPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(authPath, 0o600);
}

export async function getLoggedInProviders(): Promise<AiAuthProvider[]> {
  const data = await readAuthJson();
  return AI_AUTH_PROVIDERS.filter(provider => data[provider]?.type === 'oauth');
}

function sendAuthEvent(event: AiAuthEvent) {
  const mainWindow = getWindow(MAIN_WINDOW_ID);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(AI_AUTH_EVENTS_CHANNEL, event);
  }
}

type PendingPrompt = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

let activeLogin: AbortController | null = null;
let promptIdCounter = 0;
const pendingPrompts = new Map<number, PendingPrompt>();

function rejectPendingPrompts(reason: string) {
  for (const prompt of pendingPrompts.values()) {
    prompt.reject(new Error(reason));
  }
  pendingPrompts.clear();
}

export async function login(provider: AiAuthProvider): Promise<void> {
  if (activeLogin) {
    throw new Error('Another sign-in is already in progress');
  }
  const piAi = await loadPiAi();
  const oauthProvider = piAi.getOAuthProvider(provider);
  if (!oauthProvider) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }

  const controller = new AbortController();
  activeLogin = controller;
  log.info(`[AI-Auth] Starting ${provider} sign-in`);

  try {
    const credentials = await oauthProvider.login({
      onAuth: info => {
        sendAuthEvent({ type: 'auth', url: info.url, instructions: info.instructions });
        void shell.openExternal(info.url);
      },
      onProgress: message => {
        sendAuthEvent({ type: 'progress', message });
      },
      onPrompt: prompt =>
        new Promise<string>((resolve, reject) => {
          const id = ++promptIdCounter;
          pendingPrompts.set(id, { resolve, reject });
          sendAuthEvent({
            type: 'prompt',
            id,
            message: prompt.message,
            placeholder: prompt.placeholder,
          });
        }),
      signal: controller.signal,
    });

    const data = await readAuthJson();
    data[provider] = { type: 'oauth', ...credentials };
    await writeAuthJson(data);
    log.info(`[AI-Auth] Signed in to ${provider}`);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Sign-in cancelled');
    }
    log.warn(`[AI-Auth] ${provider} sign-in failed:`, error);
    throw error;
  } finally {
    rejectPendingPrompts('Sign-in ended');
    activeLogin = null;
  }
}

export async function cancelLogin(): Promise<void> {
  if (!activeLogin) return;
  log.info('[AI-Auth] Cancelling sign-in');
  activeLogin.abort();
  rejectPendingPrompts('Sign-in cancelled');
}

export async function respondLoginPrompt(id: number, value: string | null): Promise<void> {
  const prompt = pendingPrompts.get(id);
  if (!prompt) return;
  pendingPrompts.delete(id);
  if (value === null) {
    prompt.reject(new Error('Sign-in cancelled'));
  } else {
    prompt.resolve(value);
  }
}

export async function logout(provider: AiAuthProvider): Promise<void> {
  const data = await readAuthJson();
  if (!(provider in data)) return;
  delete data[provider];
  await writeAuthJson(data);
  log.info(`[AI-Auth] Signed out of ${provider}`);
}
