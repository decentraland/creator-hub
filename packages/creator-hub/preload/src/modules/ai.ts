import { ipcRenderer, type IpcRendererEvent } from 'electron';

import type { AiAgentState } from '/shared/types/ipc';

import { invoke } from '../services/ipc';

export type { AiAgentState };

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
