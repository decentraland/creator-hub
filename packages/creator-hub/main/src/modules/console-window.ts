// Detached console window (#1272). A second BrowserWindow that renders only the debug
// console (the SPA booted with `?view=console`), so it can be sized and placed anywhere and
// kept visible while the scene runs. Unlike the AI window, the log LINES are not mirrored:
// this window subscribes to the main-process preview debugger directly (editor.attachSceneDebugger),
// so it gets the backlog + live output on its own. The main window only relays whether the
// preview is running (CONSOLE_MIRROR_STATE), which this window can't observe by itself, and is
// told when the window opens/closes (CONSOLE_WINDOW_STATE) so it can swap the inline tab for a
// placeholder. Both are relayed through main, since two renderer processes can't talk directly.
import { fileURLToPath } from 'node:url';

import {
  CONSOLE_MIRROR_STATE,
  CONSOLE_WINDOW_STATE,
  type ConsoleMirrorState,
  type ConsoleWindowState,
} from '/shared/types/ipc';

import { MAIN_WINDOW_ID } from '../mainWindow';
import { createWindow, focusWindow, getWindow } from './window';

const CONSOLE_WINDOW_ID = 'debug-console';

function isOpen(): boolean {
  const win = getWindow(CONSOLE_WINDOW_ID);
  return win !== undefined && !win.isDestroyed();
}

// Tell the main window whether the detached console window is open, so it can show the inline
// console tab or a "opened in a separate window" placeholder.
function broadcastWindowState(): void {
  const main = getWindow(MAIN_WINDOW_ID);
  if (main !== undefined && !main.isDestroyed()) {
    const payload: ConsoleWindowState = { open: isOpen() };
    main.webContents.send(CONSOLE_WINDOW_STATE, payload);
  }
}

export async function openConsoleWindow(path: string, locale?: string): Promise<void> {
  const existing = getWindow(CONSOLE_WINDOW_ID);
  if (existing !== undefined && !existing.isDestroyed()) {
    focusWindow(existing);
    return;
  }

  const window = createWindow(CONSOLE_WINDOW_ID, {
    width: 720,
    height: 420,
    minWidth: 360,
    minHeight: 180,
    title: 'Console',
  });
  window.setMenuBarVisibility(false);

  window.on('ready-to-show', () => {
    window.show();
    if (import.meta.env.DEV) {
      window.webContents.openDevTools();
    }
  });
  // When the OS window closes, let the main window fall back to the inline console tab.
  window.on('closed', () => broadcastWindowState());

  const params = new URLSearchParams({ view: 'console', path });
  if (locale !== undefined) params.set('locale', locale);
  const search = params.toString();
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

export function closeConsoleWindow(): void {
  const win = getWindow(CONSOLE_WINDOW_ID);
  if (win !== undefined && !win.isDestroyed()) win.close();
}

export function isConsoleWindowOpen(): boolean {
  return isOpen();
}

// main window → detached: relay whether the preview is running, so the detached window knows
// to (re)attach to the debugger on the next run.
export function pushMirrorState(state: ConsoleMirrorState): void {
  const win = getWindow(CONSOLE_WINDOW_ID);
  if (win !== undefined && !win.isDestroyed()) win.webContents.send(CONSOLE_MIRROR_STATE, state);
}
