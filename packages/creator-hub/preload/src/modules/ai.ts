import { ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  AI_AUTH_EVENTS_CHANNEL,
  type AiAgentState,
  type AiAuthEvent,
  type AiAuthProvider,
} from '/shared/types/ipc';

import { invoke } from '../services/ipc';

export type { AiAgentState, AiAuthEvent, AiAuthProvider };

export type AiAgentEvent = Record<string, unknown> & { type: string };

const activeSubscriptions = new Map<string, () => void>();

export async function startAiAgent(path: string): Promise<void> {
  await invoke('ai.start', path);
}

export async function stopAiAgent(path: string): Promise<void> {
  await invoke('ai.stop', path);
}

export async function sendAiPrompt(path: string, message: string): Promise<void> {
  await invoke('ai.prompt', path, message);
}

export async function abortAi(path: string): Promise<void> {
  await invoke('ai.abort', path);
}

export async function getAiAgentState(path: string): Promise<AiAgentState> {
  return invoke('ai.getState', path);
}

export async function getAiMessages(path: string): Promise<unknown[]> {
  return invoke('ai.getMessages', path);
}

export async function newAiSession(path: string): Promise<void> {
  await invoke('ai.newSession', path);
}

/**
 * Runs an OAuth sign-in flow for the given provider. Interim events (browser
 * URL, device-code instructions, progress, prompts) are delivered through
 * `onEvent`; the returned promise settles when the flow completes or fails.
 */
export async function loginAiProvider(
  provider: AiAuthProvider,
  onEvent: (event: AiAuthEvent) => void,
): Promise<void> {
  const handler = (_: IpcRendererEvent, event: AiAuthEvent) => onEvent(event);
  ipcRenderer.on(AI_AUTH_EVENTS_CHANNEL, handler);
  try {
    await invoke('ai.login', provider);
  } finally {
    ipcRenderer.off(AI_AUTH_EVENTS_CHANNEL, handler);
  }
}

export async function cancelAiLogin(): Promise<void> {
  await invoke('ai.cancelLogin');
}

export async function logoutAiProvider(provider: AiAuthProvider): Promise<void> {
  await invoke('ai.logout', provider);
}

export async function respondAiLoginPrompt(id: number, value: string | null): Promise<void> {
  await invoke('ai.respondLoginPrompt', id, value);
}

export async function subscribeAiEvents(
  path: string,
  cb: (event: AiAgentEvent) => void,
): Promise<{ cleanup: () => void }> {
  // Clean up any previous subscription for this path (handles React StrictMode double-mount)
  activeSubscriptions.get(path)?.();

  const eventName = await invoke('ai.start', path);

  const handler = (_: IpcRendererEvent, event: AiAgentEvent) => cb(event);
  ipcRenderer.on(eventName, handler);

  const cleanup = () => {
    ipcRenderer.off(eventName, handler);
    activeSubscriptions.delete(path);
  };

  activeSubscriptions.set(path, cleanup);

  return { cleanup };
}
