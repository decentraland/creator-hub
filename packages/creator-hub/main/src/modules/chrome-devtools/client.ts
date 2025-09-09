import { shell } from 'electron';
import log from 'electron-log/main';
import { Ok, Err, type Result } from 'ts-results';

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
): ChromeDevToolsClient {
  let chromeDevToolsFrontendServer: ChromeDevToolsFrontendServer | null = null;

  function newTargetUrl(frontendPort: number, backendPort: number): string {
    return `http://localhost:${frontendPort}/inspector.html?ws=127.0.0.1:${backendPort}`;
  }

  async function openTabInternal(backendPort: ServerPort): Promise<Result<void, string>> {
    if (chromeDevToolsFrontendServer === null) {
      const downloadResult = await downloadDaemon.ensureDownloaded();
      if (downloadResult.ok === false) {
        return new Err('Cannot download static server: ' + downloadResult.val);
      }

      const staticServerPathResult = await downloadDaemon.staticServerPath();
      if (staticServerPathResult.ok === false) {
        return new Err('Cannot get static server path: ' + staticServerPathResult.val);
      }

      chromeDevToolsFrontendServer = newChromeDevToolsFrontendServer(staticServerPathResult.val);
    }

    if (chromeDevToolsFrontendServer.isRunning() === false) {
      log.info('[DEVTOOLS] starting devtools server');
      const startResult = await chromeDevToolsFrontendServer.start();
      if (startResult.ok === false) {
        return new Err('Cannot start server: ' + startResult.val);
      }
    }

    const portResult = chromeDevToolsFrontendServer.port();
    if (portResult.ok === false) {
      return new Err('Port is not available: ' + portResult.val);
    }

    const frontendServerPort = portResult.val;

    log.info('[DEVTOOLS] opening devtools tab');
    const url = newTargetUrl(frontendServerPort.port, backendPort.port);
    await shell.openExternal(url);
    return Ok(undefined);
  }

  async function openTab(backendPort: ServerPort): Promise<Result<void, string>> {
    const result = await openTabInternal(backendPort);
    if (result.ok) {
      log.info('[DEVTOOLS] opened devtools tab for port ' + backendPort.port);
    } else {
      log.error('[DEVTOOLS] failed to open devtools tab: ' + result.val);
    }
    return result;
  }

  return {
    openTab,
  };
}
