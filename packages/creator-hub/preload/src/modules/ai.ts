import { ipcRenderer, type IpcRendererEvent } from 'electron';

import { AI_STREAM_EVENT } from '/shared/types/ipc';
import type { AiEvent, AiProviderInfo, AiSendParams } from '/shared/types/ai';

import { invoke } from '../services/ipc';

export type { AiEvent, AiProviderInfo, AiSendParams };

export async function detectProviders(): Promise<AiProviderInfo[]> {
  return invoke('ai.detectProviders');
}

// Start one turn. Its events stream over AI_STREAM_EVENT — subscribe with
// `subscribeAiStream` before calling this. Returns the turnId that correlates them.
export async function send(path: string, params: AiSendParams): Promise<{ turnId: string }> {
  return invoke('ai.send', path, params);
}

export async function stop(): Promise<void> {
  return invoke('ai.stop');
}

export async function reset(): Promise<void> {
  return invoke('ai.reset');
}

export async function isBusy(): Promise<boolean> {
  return invoke('ai.isBusy');
}

// Subscribe to the AI turn event stream. There is one active turn at a time and one
// editor window, so a single fixed channel is enough; the panel filters by turnId.
export function subscribeAiStream(cb: (event: AiEvent) => void): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, event: AiEvent) => cb(event);
  ipcRenderer.on(AI_STREAM_EVENT, handler);
  return { cleanup: () => ipcRenderer.off(AI_STREAM_EVENT, handler) };
}
