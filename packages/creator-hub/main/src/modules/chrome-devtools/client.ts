import { shell } from 'electron';
import log from 'electron-log/main';
import { Ok, Err, type Result } from 'ts-results-es';

import { type ChromeDevToolsRendererIpcBridge } from './ipc-bridge';
import { type ChromeDevToolsDownloadDaemon } from './download-daemon';
import {
  type ChromeDevToolsFrontendServer,
  newChromeDevToolsFrontendServer,
} from './frontend-server';

export type ServerPort = {
  port: number;
};

export type ChromeDevToolsClient = {
  openTab(backendPort: ServerPort): Promise<Result<void, string>>;
};

export function newChromeDevToolsClient(
  downloadDaemon: ChromeDevToolsDownloadDaemon,
  ipcBridge: ChromeDevToolsRendererIpcBridge,
): ChromeDevToolsClient {
  let chromeDevToolsFrontendServer: ChromeDevToolsFrontendServer | null = null;

  function newTargetUrl(frontendPort: number, backendPort: number): string {
    return `http://localhost:${frontendPort}/inspector.html?ws=127.0.0.1:${backendPort}`;
  }

  async function openTabInternal(backendPort: ServerPort): Promise<Result<void, string>> {
    if (chromeDevToolsFrontendServer === null) {
      ipcBridge.notify({ kind: 'CreatingDevToolsServer' });

      const downloadResult = await downloadDaemon.ensureDownloaded();
      if (downloadResult.isOk() === false) {
        return new Err('Cannot download static server: ' + downloadResult.error);
      }

      const staticServerPathResult = await downloadDaemon.staticServerPath();
      if (staticServerPathResult.isOk() === false) {
        return new Err('Cannot get static server path: ' + staticServerPathResult.error);
      }

      chromeDevToolsFrontendServer = newChromeDevToolsFrontendServer(staticServerPathResult.value);
    }

    if (chromeDevToolsFrontendServer.isRunning() === false) {
      log.info('[DEVTOOLS] starting devtools server');
      ipcBridge.notify({ kind: 'StartingDevToolsServer' });

      const startResult = await chromeDevToolsFrontendServer.start();
      if (startResult.isOk() === false) {
        return new Err('Cannot start server: ' + startResult.error);
      }
    }

    const portResult = chromeDevToolsFrontendServer.port();
    if (portResult.isOk() === false) {
      return new Err('Port is not available: ' + portResult.error);
    }

    const frontendServerPort = portResult.value;

    log.info('[DEVTOOLS] opening devtools tab');
    ipcBridge.notify({ kind: 'OpeningTab' });
    const url = newTargetUrl(frontendServerPort.port, backendPort.port);
    await shell.openExternal(url);
    return Ok(undefined);
  }

  async function openTab(backendPort: ServerPort): Promise<Result<void, string>> {
    const result = await openTabInternal(backendPort);
    if (result.isOk()) {
      ipcBridge.notify({ kind: 'OpenedTab' });
      log.info('[DEVTOOLS] opened devtools tab for port ' + backendPort.port);
    } else {
      ipcBridge.notify({ kind: 'FlowError' });
      log.error('[DEVTOOLS] failed to open devtools tab: ' + result.error);
    }
    return result;
  }

  return {
    openTab,
  };
}
