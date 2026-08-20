import { ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  AI_SCENE_OP_REQUEST,
  AI_SCREENSHOT_REQUEST,
  AI_STREAM_EVENT,
  type AiSceneOpRequest,
  type AiScreenshotRequest,
} from '/shared/types/ipc';
import type { AiEvent, AiProviderInfo, AiSendParams } from '/shared/types/ai';

import { invoke } from '../services/ipc';

export type { AiEvent, AiProviderInfo, AiSendParams, AiScreenshotRequest, AiSceneOpRequest };

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

// The `editor_screenshot` MCP tool asks (via main) for a viewport capture; the editor
// page answers with `screenshotResult`. Only the renderer can reach the inspector iframe.
export function onScreenshotRequest(cb: (req: AiScreenshotRequest) => void): {
  cleanup: () => void;
} {
  const handler = (_: IpcRendererEvent, req: AiScreenshotRequest) => cb(req);
  ipcRenderer.on(AI_SCREENSHOT_REQUEST, handler);
  return { cleanup: () => ipcRenderer.off(AI_SCREENSHOT_REQUEST, handler) };
}

export function screenshotResult(id: string, dataUrl: string | null): void {
  void invoke('ai.screenshotResult', id, dataUrl);
}

// Scene-graph mutation ops (Phase 2): main asks the renderer to run an inspector SceneRpc
// mutation; the renderer answers with `sceneOpResult`. Only the renderer can reach the iframe.
export function onSceneOpRequest(cb: (req: AiSceneOpRequest) => void): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, req: AiSceneOpRequest) => cb(req);
  ipcRenderer.on(AI_SCENE_OP_REQUEST, handler);
  return { cleanup: () => ipcRenderer.off(AI_SCENE_OP_REQUEST, handler) };
}

export function sceneOpResult(id: string, ok: boolean, payload: unknown): void {
  void invoke('ai.sceneOpResult', id, ok, payload);
}
