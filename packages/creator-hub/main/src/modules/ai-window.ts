// Detached AI assistant window (#1504). A second BrowserWindow that renders only the
// chat (the SPA booted with `?view=ai-chat`). It keeps NO store of its own: the main
// window remains the single source of truth and mirrors its `ai` slice here, while this
// window sends the user's actions back — both relayed through this module, since two
// renderer processes can't message each other directly.
import { fileURLToPath } from 'node:url';

import {
  AI_MIRROR_STATE,
  AI_REMOTE_COMMAND,
  AI_WINDOW_STATE,
  type AiWindowState,
} from '/shared/types/ipc';
import type { AiMirrorState, AiRemoteCommand } from '/shared/types/ai';

import { MAIN_WINDOW_ID } from '../mainWindow';
import { createWindow, focusWindow, getWindow } from './window';

const AI_WINDOW_ID = 'ai-chat';

function isOpen(): boolean {
  const win = getWindow(AI_WINDOW_ID);
  return win !== undefined && !win.isDestroyed();
}

// Tell the main window whether the detached window is open, so it can show the inline
// panel or a "opened in a separate window" placeholder.
function broadcastWindowState(): void {
  const main = getWindow(MAIN_WINDOW_ID);
  if (main !== undefined && !main.isDestroyed()) {
    const payload: AiWindowState = { open: isOpen() };
    main.webContents.send(AI_WINDOW_STATE, payload);
  }
}

export async function openAiWindow(locale?: string): Promise<void> {
  const existing = getWindow(AI_WINDOW_ID);
  if (existing !== undefined && !existing.isDestroyed()) {
    focusWindow(existing);
    return;
  }

  const window = createWindow(AI_WINDOW_ID, {
    width: 420,
    height: 760,
    minWidth: 340,
    minHeight: 420,
    title: 'AI Assistant',
  });
  window.setMenuBarVisibility(false);

  window.on('ready-to-show', () => {
    window.show();
    if (import.meta.env.DEV) {
      window.webContents.openDevTools();
    }
  });
  // When the OS window closes, let the main window fall back to the inline panel.
  window.on('closed', () => broadcastWindowState());

  const search = `view=ai-chat${locale !== undefined ? `&locale=${encodeURIComponent(locale)}` : ''}`;
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    await window.loadURL(`${import.meta.env.VITE_DEV_SERVER_URL}?${search}`);
  } else {
    await window.loadFile(
      fileURLToPath(new URL('./../../renderer/dist/index.html', import.meta.url)),
      { search },
    );
  }

  broadcastWindowState();
}

export function closeAiWindow(): void {
  const win = getWindow(AI_WINDOW_ID);
  if (win !== undefined && !win.isDestroyed()) win.close();
}

export function isAiWindowOpen(): boolean {
  return isOpen();
}

// main window → detached: push the mirrored chat state.
export function pushMirrorState(state: AiMirrorState): void {
  const win = getWindow(AI_WINDOW_ID);
  if (win !== undefined && !win.isDestroyed()) win.webContents.send(AI_MIRROR_STATE, state);
}

// detached → main window: forward a user action to run against the single store.
export function forwardRemoteCommand(command: AiRemoteCommand): void {
  const main = getWindow(MAIN_WINDOW_ID);
  if (main !== undefined && !main.isDestroyed()) main.webContents.send(AI_REMOTE_COMMAND, command);
}
