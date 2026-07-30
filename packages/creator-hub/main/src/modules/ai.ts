import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { app } from 'electron';
import log from 'electron-log';

import type { AiAgentState } from '/shared/types/ipc';

import { MAIN_WINDOW_ID } from '../mainWindow';

import { getConfig } from './config';
import { createJsonlSplitter, parseJsonlLine } from './jsonl';
import { getBinPath } from './path';
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

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('Missing Anthropic API key. Add it in the AI Assistant panel settings.');
  }

  let entryPath: string;
  try {
    entryPath = getBinPath('@dcl-regenesislabs/opendcl', 'opendcl');
  } catch {
    // Running the production bundles straight from the source tree (e.g. the
    // Playwright e2e harness) has no app.asar.unpacked dir; fall back to the
    // monorepo root node_modules.
    const workspaceRoot = nodePath.join(app.getAppPath(), '..', '..');
    entryPath = getBinPath('@dcl-regenesislabs/opendcl', 'opendcl', workspaceRoot);
  }
  const eventName = getAiChannel(path);

  // Install/refresh the official Decentraland SDK skills in the project so
  // they take precedence over opendcl's bundled (outdated) ones. Never
  // throws: on failure the agent starts with whatever skills are available.
  await ensureSdkSkills(path);

  log.info(`[AI] Starting agent for ${path}`);
  // The model is pinned explicitly: pi otherwise picks its own default (from
  // local state or other provider keys), which may not be an Anthropic model
  // even though the user configured an Anthropic API key.
  const args = [entryPath, '--mode', 'rpc', '--headless', '--model', 'anthropic/claude-sonnet-4-5'];
  // Pass the project skills dir explicitly and BEFORE opendcl's own args:
  // opendcl appends its bundled --skill dir after user args, and pi keeps the
  // first skill found on a name collision, so ours must come first.
  const projectSkillsPath = nodePath.join(path, '.agents', 'skills');
  try {
    const stat = await fs.stat(projectSkillsPath);
    if (stat.isDirectory()) {
      args.splice(1, 0, '--skill', projectSkillsPath);
    }
  } catch {
    // No project skills installed (e.g. first run offline); opendcl falls
    // back to its bundled skills.
  }
  const child = spawn(process.execPath, args, {
    cwd: path,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ANTHROPIC_API_KEY: apiKey,
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
  return {
    running: !!agent && agent.child.exitCode === null && !agent.child.killed,
    hasApiKey: !!apiKey,
  };
}
