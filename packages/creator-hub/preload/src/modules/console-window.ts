// Detached console window bridge (#1272). Exposed to the renderer as `consoleWindow` (not
// `console`, to avoid shadowing the global). Mirrors the AI window helpers in ai.ts.
import { ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  CONSOLE_MIRROR_STATE,
  CONSOLE_WINDOW_STATE,
  type ConsoleMirrorState,
  type ConsoleWindowState,
} from '/shared/types/ipc';

import { invoke } from '../services/ipc';

// Open (or focus) the detached console window for `path`, seeded with the app locale for i18n.
export async function openConsoleWindow(path: string, locale?: string): Promise<void> {
  return invoke('console.openWindow', path, locale);
}

// Close the detached window (dock the console back inline).
export async function closeConsoleWindow(): Promise<void> {
  return invoke('console.closeWindow');
}

export async function isConsoleWindowOpen(): Promise<boolean> {
  return invoke('console.isWindowOpen');
}

// Main window → detached: relay whether the preview is running.
export function pushConsoleMirrorState(state: ConsoleMirrorState): void {
  void invoke('console.mirrorPush', state);
}

// Detached: receive the preview-running relay.
export function onConsoleMirrorState(cb: (state: ConsoleMirrorState) => void): {
  cleanup: () => void;
} {
  const handler = (_: IpcRendererEvent, state: ConsoleMirrorState) => cb(state);
  ipcRenderer.on(CONSOLE_MIRROR_STATE, handler);
  return { cleanup: () => ipcRenderer.off(CONSOLE_MIRROR_STATE, handler) };
}

// Main window: learn when the detached window opens/closes (show inline tab vs placeholder).
export function onConsoleWindowState(cb: (state: ConsoleWindowState) => void): {
  cleanup: () => void;
} {
  const handler = (_: IpcRendererEvent, state: ConsoleWindowState) => cb(state);
  ipcRenderer.on(CONSOLE_WINDOW_STATE, handler);
  return { cleanup: () => ipcRenderer.off(CONSOLE_WINDOW_STATE, handler) };
}
