import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { app } from 'electron';
import log from 'electron-log';

import type { AiAgentState, AiAuthProvider } from '/shared/types/ipc';

import { MAIN_WINDOW_ID } from '../mainWindow';

import { getLoggedInProviders, getPiAgentDir } from './ai-auth';
import { getConfig } from './config';
import { createJsonlSplitter, parseJsonlLine } from './jsonl';
import { APP_UNPACKED_PATH, getBinPath } from './path';
import { ensureSdkSkills } from './sdk-skills';
import { getWindow } from './window';

type AgentProcess = {
  child: ChildProcessWithoutNullStreams;
  eventName: string;
};

const agents: Map<string, AgentProcess> = new Map();

const DIALOG_UI_METHODS = ['select', 'confirm', 'input', 'editor'];

function getAiChannel(path: string) {
  return `ai://${path}`;
}

function sendToRenderer(eventName: string, payload: unknown) {
  const mainWindow = getWindow(MAIN_WINDOW_ID);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(eventName, payload);
  }
}

function writeCommand(child: ChildProcessWithoutNullStreams, command: Record<string, unknown>) {
  child.stdin.write(`${JSON.stringify(command)}\n`);
}

async function getAnthropicApiKey(): Promise<string | undefined> {
  const config = await getConfig();
  return config.settings.aiAgent?.anthropicApiKey || undefined;
}

// The agent's skills and prompts are tuned against Claude, so providers that
// serve Claude models take precedence when the user is signed in to several.
const MODEL_BY_PROVIDER: Record<AiAuthProvider, string> = {
  anthropic: 'anthropic/claude-sonnet-4-5',
  'github-copilot': 'github-copilot/claude-sonnet-4.5',
  'openai-codex': 'openai-codex/gpt-5.1-codex-max',
};
const PROVIDER_PRECEDENCE: AiAuthProvider[] = ['anthropic', 'github-copilot', 'openai-codex'];

async function resolveAuth(): Promise<{ model: string; apiKey?: string }> {
  const apiKey = await getAnthropicApiKey();
  const oauthProviders = await getLoggedInProviders();
  // An explicit API key and an Anthropic OAuth login both run the same model;
  // pi prefers stored OAuth credentials over the env key when both exist.
  if (apiKey || oauthProviders.includes('anthropic')) {
    return { model: MODEL_BY_PROVIDER.anthropic, apiKey };
  }
  const provider = PROVIDER_PRECEDENCE.find(p => oauthProviders.includes(p));
  if (provider) {
    return { model: MODEL_BY_PROVIDER[provider] };
  }
  throw new Error(
    'No AI credentials configured. Sign in or add an API key in the AI Assistant panel.',
  );
}

/**
 * The agent process is pi itself, spawned directly — opendcl's entry point
 * only assembles pi CLI args, and assembling them ourselves lets us pick
 * which of its extensions run. The opendcl package stays installed as the
 * asset carrier: system prompt, context docs, extension files, fallback
 * skills all still come from it.
 */
async function getOpendclDir(): Promise<string> {
  const candidates = [
    nodePath.join(APP_UNPACKED_PATH, 'node_modules', '@dcl-regenesislabs', 'opendcl'),
    // Running the production bundles straight from the source tree (e.g. the
    // Playwright e2e harness) has no app.asar.unpacked dir; fall back to the
    // monorepo root node_modules.
    nodePath.join(app.getAppPath(), '..', '..', 'node_modules', '@dcl-regenesislabs', 'opendcl'),
  ];
  for (const dir of candidates) {
    try {
      await fs.stat(nodePath.join(dir, 'package.json'));
      return dir;
    } catch {
      // Try the next location.
    }
  }
  throw new Error('Could not find the installed @dcl-regenesislabs/opendcl package');
}

function getPiEntryPath(opendclDir: string): string {
  // pi is a dependency of opendcl, usually hoisted to the same node_modules
  // root that contains opendcl itself.
  const hoistRoot = nodePath.join(opendclDir, '..', '..', '..');
  try {
    return getBinPath('@mariozechner/pi-coding-agent', 'pi', hoistRoot);
  } catch {
    return getBinPath('@mariozechner/pi-coding-agent', 'pi', opendclDir);
  }
}

/**
 * Builds the system prompt the way opendcl's entry point does: strip the YAML
 * frontmatter from prompts/system.md and resolve its `context/<file>.md`
 * references to absolute paths so the agent can read them.
 */
async function buildSystemPrompt(opendclDir: string): Promise<string> {
  const raw = await fs.readFile(nodePath.join(opendclDir, 'prompts', 'system.md'), 'utf8');
  const contextDir = nodePath.join(opendclDir, 'context');
  return raw
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/context\/([\w-]+\.md)/g, (_, filename) => nodePath.join(contextDir, filename))
    .trim();
}

function handleEvent(path: string, event: Record<string, unknown>) {
  const agent = agents.get(path);

  // Auto-cancel dialog UI requests so the agent never hangs waiting for a
  // response we can't provide in the POC (this includes `confirm`, which is
  // not safe to auto-approve).
  if (
    agent &&
    event.type === 'extension_ui_request' &&
    typeof event.method === 'string' &&
    DIALOG_UI_METHODS.includes(event.method)
  ) {
    writeCommand(agent.child, {
      type: 'extension_ui_response',
      id: event.id,
      cancelled: true,
    });
  }

  sendToRenderer(getAiChannel(path), event);
}

export async function start(path: string): Promise<string> {
  const existing = agents.get(path);
  if (existing && existing.child.exitCode === null && !existing.child.killed) {
    return existing.eventName;
  }
  agents.delete(path);

  const { model, apiKey } = await resolveAuth();

  const opendclDir = await getOpendclDir();
  const entryPath = getPiEntryPath(opendclDir);
  const eventName = getAiChannel(path);

  // Install/refresh the official Decentraland SDK skills in the project.
  // Never throws: on failure the agent starts with the fallback skills below.
  await ensureSdkSkills(path);

  log.info(`[AI] Starting agent for ${path} with model ${model}`);
  const args = [
    entryPath,
    '--mode',
    'rpc',
    // The model is pinned explicitly: pi otherwise picks its own default
    // (from local state or other provider keys), which may not match the
    // credentials the user configured in the AI Assistant panel.
    '--model',
    model,
    '--system-prompt',
    await buildSystemPrompt(opendclDir),
    // Cherry-picked opendcl extensions: scene metadata injection into the
    // prompt, and an automatic typecheck after every TypeScript write.
    // dcl-asset-path is deliberately excluded — its case-sensitive path guard
    // rejects the Creator Hub `assets/Models/` convention and tells the agent
    // to download models to a root `models/` dir Creator Hub can't see.
    '-e',
    nodePath.join(opendclDir, 'extensions', 'dcl-context.ts'),
    '-e',
    nodePath.join(opendclDir, 'extensions', 'dcl-validate.ts'),
  ];
  const projectSkillsPath = nodePath.join(path, '.agents', 'skills');
  try {
    const stat = await fs.stat(projectSkillsPath);
    if (!stat.isDirectory()) throw new Error('not a directory');
    args.push('--skill', projectSkillsPath);
  } catch {
    // No project skills installed (e.g. first run offline): fall back to
    // opendcl's bundled (older) skills rather than running with none.
    args.push('--skill', nodePath.join(opendclDir, 'skills'));
  }
  const child = spawn(process.execPath, args, {
    cwd: path,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      // pi's config dir — must match where ai-auth writes OAuth credentials.
      // opendcl's entry point used to set this; spawning pi directly, we do.
      PI_CODING_AGENT_DIR: getPiAgentDir(),
      PI_SKIP_VERSION_CHECK: '1',
      // With OAuth sign-in there is no key to pass: pi reads (and refreshes)
      // the stored credentials from its own auth.json.
      ...(apiKey ? { ANTHROPIC_API_KEY: apiKey } : {}),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const splitter = createJsonlSplitter(line => {
    const event = parseJsonlLine(line);
    if (event) {
      handleEvent(path, event);
    } else if (line.trim()) {
      log.info(`[AI] Non-JSON output for ${path}: ${line}`);
    }
  });

  child.stdout.on('data', (chunk: Buffer) => splitter.feed(chunk));
  child.stdout.on('end', () => splitter.end());

  child.stderr.on('data', (chunk: Buffer) => {
    log.info(`[AI] stderr for ${path}: ${chunk.toString('utf8').trimEnd()}`);
  });

  child.on('error', error => {
    log.error(`[AI] Agent process error for ${path}:`, error);
    agents.delete(path);
    sendToRenderer(eventName, { type: 'agent_exit', code: null, error: error.message });
  });

  child.on('exit', code => {
    log.info(`[AI] Agent for ${path} exited with code ${code}`);
    agents.delete(path);
    sendToRenderer(eventName, { type: 'agent_exit', code });
  });

  agents.set(path, { child, eventName });

  return eventName;
}

export async function stop(path: string): Promise<void> {
  const agent = agents.get(path);
  if (!agent) return;
  agents.delete(path);
  log.info(`[AI] Stopping agent for ${path}`);
  agent.child.removeAllListeners('exit');
  agent.child.kill();
}

export async function stopAll(): Promise<void> {
  await Promise.all([...agents.keys()].map(path => stop(path)));
}

export async function prompt(path: string, message: string): Promise<void> {
  const agent = agents.get(path);
  if (!agent) {
    throw new Error(`No AI agent running for path: ${path}`);
  }
  writeCommand(agent.child, { type: 'prompt', message });
}

export async function abort(path: string): Promise<void> {
  const agent = agents.get(path);
  if (!agent) return;
  writeCommand(agent.child, { type: 'abort' });
}

export async function getState(path: string): Promise<AiAgentState> {
  const agent = agents.get(path);
  const apiKey = await getAnthropicApiKey();
  const oauthProviders = await getLoggedInProviders();
  return {
    running: !!agent && agent.child.exitCode === null && !agent.child.killed,
    hasApiKey: !!apiKey,
    oauthProviders,
  };
}
