import { ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  AI_ASK_REQUEST,
  AI_CLI_LOGIN_EVENTS,
  AI_MIRROR_STATE,
  AI_REMOTE_COMMAND,
  AI_SCENE_OP_REQUEST,
  AI_SCREENSHOT_REQUEST,
  AI_STREAM_EVENT,
  AI_WINDOW_STATE,
  type AiAskRequest,
  type AiCliLoginEvent,
  type AiCliState,
  type AiSceneOpRequest,
  type AiScreenshotRequest,
  type AiWindowState,
} from '/shared/types/ipc';
import type {
  AiEvent,
  AiMirrorState,
  AiProviderInfo,
  AiRemoteCommand,
  AiSendParams,
} from '/shared/types/ai';

import { invoke } from '../services/ipc';

export type {
  AiEvent,
  AiProviderInfo,
  AiSendParams,
  AiScreenshotRequest,
  AiSceneOpRequest,
  AiAskRequest,
};
export type { AiMirrorState, AiRemoteCommand, AiWindowState };
export type { AiCliLoginEvent, AiCliState };

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

export async function reset(path?: string): Promise<void> {
  return invoke('ai.reset', path);
}

// Delete one saved session's provider resume ids (removing it from the scene's history).
export async function deleteSession(path: string, sessionId: string): Promise<void> {
  return invoke('ai.deleteSession', path, sessionId);
}

export async function isBusy(): Promise<boolean> {
  return invoke('ai.isBusy');
}

// Revert the scene-graph changes an AI turn made (undo `count` steps — the value the
// turn's `done` event reported as `mutations`).
export async function revertTurn(count: number): Promise<void> {
  return invoke('ai.revertTurn', count);
}

export async function getMcpServerInfo(): Promise<{ url: string; token: string }> {
  return invoke('ai.getMcpServerInfo');
}

// AI sign-in without a CLI (#1531). Installs the official CLI on demand (if needed) and
// drives its subscription login; steps (progress + the browser URL) arrive via `onEvent`,
// and the promise settles when the flow completes or fails. The channel subscription is
// scoped to the call.
export async function signInCli(
  provider: 'claude' | 'codex',
  onEvent: (event: AiCliLoginEvent) => void,
): Promise<void> {
  const handler = (_: IpcRendererEvent, event: AiCliLoginEvent) => onEvent(event);
  ipcRenderer.on(AI_CLI_LOGIN_EVENTS, handler);
  try {
    await invoke('ai.signInCli', provider);
  } finally {
    ipcRenderer.off(AI_CLI_LOGIN_EVENTS, handler);
  }
}

export async function cancelSignInCli(): Promise<void> {
  return invoke('ai.cancelSignInCli');
}

export async function signOutCli(provider: 'claude' | 'codex'): Promise<void> {
  return invoke('ai.signOutCli', provider);
}

export async function getCliState(): Promise<AiCliState> {
  return invoke('ai.getCliState');
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

// The `ask_user` MCP tool (via main) asks the user a question; the chat panel renders it and
// answers with `answerPrompt`. A null answer means dismissed.
export function onAskRequest(cb: (req: AiAskRequest) => void): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, req: AiAskRequest) => cb(req);
  ipcRenderer.on(AI_ASK_REQUEST, handler);
  return { cleanup: () => ipcRenderer.off(AI_ASK_REQUEST, handler) };
}

export function answerPrompt(id: string, answer: string | null): void {
  void invoke('ai.askResult', id, answer);
}

// Compositor capture of a window region (the Bevy editor-screenshot fallback, #1526).
export async function captureViewport(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<string | null> {
  return invoke('ai.captureViewport', rect);
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

// --- Detached AI window (#1504) -------------------------------------------------------

// Open (or focus) the detached chat window, seeded with the app locale for its i18n.
export async function openAiWindow(locale?: string): Promise<void> {
  return invoke('ai.openWindow', locale);
}

// Close the detached window (dock the chat back inline).
export async function closeAiWindow(): Promise<void> {
  return invoke('ai.closeWindow');
}

export async function isAiWindowOpen(): Promise<boolean> {
  return invoke('ai.isWindowOpen');
}

// Main window → detached: push the current chat state to mirror.
export function pushAiMirrorState(state: AiMirrorState): void {
  void invoke('ai.mirrorPush', state);
}

// Detached: receive the mirrored chat state.
export function onAiMirrorState(cb: (state: AiMirrorState) => void): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, state: AiMirrorState) => cb(state);
  ipcRenderer.on(AI_MIRROR_STATE, handler);
  return { cleanup: () => ipcRenderer.off(AI_MIRROR_STATE, handler) };
}

// Detached → main window: forward a user action to run against the single store.
export function sendAiRemoteCommand(command: AiRemoteCommand): void {
  void invoke('ai.remoteCommand', command);
}

// Main window: receive the detached window's actions.
export function onAiRemoteCommand(cb: (command: AiRemoteCommand) => void): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, command: AiRemoteCommand) => cb(command);
  ipcRenderer.on(AI_REMOTE_COMMAND, handler);
  return { cleanup: () => ipcRenderer.off(AI_REMOTE_COMMAND, handler) };
}

// Main window: learn when the detached window opens/closes (show inline panel vs placeholder).
export function onAiWindowState(cb: (state: AiWindowState) => void): { cleanup: () => void } {
  const handler = (_: IpcRendererEvent, state: AiWindowState) => cb(state);
  ipcRenderer.on(AI_WINDOW_STATE, handler);
  return { cleanup: () => ipcRenderer.off(AI_WINDOW_STATE, handler) };
}
