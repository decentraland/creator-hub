import { getWindow } from '../window';
import { type ChromeDevToolsEvent } from '/shared/types/ipc';
import { MAIN_WINDOW_ID } from '../../mainWindow';

export type ChromeDevToolsRendererIpcBridge = {
  notify(event: ChromeDevToolsEvent): void;
};

export function newChromeDevToolsRendererIpcBridge(): ChromeDevToolsRendererIpcBridge {
  function notify(event: ChromeDevToolsEvent): void {
    const mainWindow = getWindow(MAIN_WINDOW_ID);
    if (mainWindow) {
      mainWindow.webContents.send('chrome-devtools.event', event);
    }
  }

  return {
    notify,
  };
}
