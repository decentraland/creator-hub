import { handle, handleSync } from './handle';
import * as electron from './electron';
import * as updater from './updater';
import * as inspector from './inspector';
import * as cli from './cli';
import * as bin from './bin';
import * as code from './code';
import * as analytics from './analytics';
import * as npm from './npm';
import * as config from './config';
import * as sceneLog from './scene-log-server';

interface InitIpcOptions {
  beforeQuitCleanup: () => Promise<void>;
}

export function initIpc({ beforeQuitCleanup }: InitIpcOptions) {
  // electron
  handleSync('electron.getEnvOverride', () => electron.getEnvOverride());
  handle('electron.getAppVersion', () => electron.getAppVersion());
  handle('electron.getUserDataPath', () => electron.getUserDataPath());
  handle('electron.getWorkspaceConfigPath', (_event, path) =>
    electron.getWorkspaceConfigPath(path),
  );
  handle('electron.showOpenDialog', (_event, opts) => electron.showOpenDialog(opts));
  handle('electron.openExternal', (_event, url) => electron.openExternal(url));
  handle('electron.copyToClipboard', (_event, text) => electron.copyToClipboard(text));

  // updater
  handle('updater.checkForUpdates', (_event, config) => updater.checkForUpdates(config));
  handle('updater.quitAndInstall', (_event, version) =>
    updater.quitAndInstall(version, beforeQuitCleanup),
  );
  handle('updater.downloadUpdate', () => updater.downloadUpdate());
  handle('updater.setupUpdaterEvents', event => updater.setupUpdaterEvents(event));
  handle('updater.getInstalledVersion', () => updater.getInstalledVersion());
  handle('updater.deleteVersionFile', () => updater.deleteVersionFile());
  handle('updater.getReleaseNotes', (_event, version) => updater.getReleaseNotes(version));

  // inspector
  handle('inspector.start', () => inspector.start());
  handle('inspector.attachSceneDebugger', (_event, path) => inspector.attachSceneDebugger(path));
  handle('inspector.detachSceneDebugger', (_event, path) => inspector.detachSceneDebugger(path));

  // cli
  handle('cli.init', (_event, path, repo) => cli.init(path, repo));
  handle('cli.start', (_event, path, opts) => cli.start(path, opts));
  handle('cli.deploy', (_event, opts) => cli.deploy(opts));
  handle('cli.killPreview', (_event, path) => cli.killPreview(path));
  handle('cli.getMobilePreview', (_event, path) => cli.getMobilePreview(path));

  // scene log
  handle('sceneLog.getSessions', async () =>
    sceneLog.getSceneLogSessions().map(s => ({
      id: s.id,
      sessionId: s.sessionId,
      deviceName: s.deviceName,
      connectedAt: s.connectedAt.toISOString(),
      disconnectedAt: s.disconnectedAt?.toISOString() ?? null,
      status: s.status,
      messageCount: s.messageCount,
    })),
  );
  handle('sceneLog.getConsoleEntries', async (_event, afterIndex: number) =>
    sceneLog.getConsoleEntries(afterIndex),
  );
  handle('sceneLog.getMonitorStats', async () => sceneLog.getMonitorStats());
  handle('sceneLog.getRawEntries', async (_event, afterIndex: number) =>
    sceneLog.getRawEntries(afterIndex),
  );
  handle('sceneLog.clear', async () => sceneLog.clearSceneLogData());
  handle(
    'sceneLog.sendCommand',
    async (_event, sessionId: number, cmd: string, args: Record<string, unknown>) =>
      sceneLog.sendCommand(sessionId, cmd, args),
  );
  handle('sceneLog.broadcastCommand', async (_event, cmd: string, args: Record<string, unknown>) =>
    sceneLog.broadcastCommand(cmd, args),
  );
  handle('sceneLog.startServer', async () => {
    const serverPort = await sceneLog.startSceneLogServer();
    return { port: serverPort };
  });
  handle('sceneLog.stopServer', async () => sceneLog.stopSceneLogServer());
  handle('sceneLog.getServerStatus', async () => sceneLog.getSceneLogServerStatus());
  handle('sceneLog.getStandaloneDeeplink', async () => sceneLog.getStandaloneDeeplink());

  // config
  handle('config.getConfig', () => config.getConfig());
  handle('config.writeConfig', (_event, _config) => config.writeConfig(_config));

  // bin
  handle('bin.install', () => bin.install());

  // code settings
  handle('code.open', (_event, path) => code.open(path));
  handle('code.getEditors', () => code.getEditors());
  handle('code.addEditor', (_event, path) => code.addEditor(path));
  handle('code.setDefaultEditor', (_event, path) => code.setDefaultEditor(path));
  handle('code.removeEditor', (_event, path) => code.removeEditor(path));

  // analytics
  handle('analytics.track', (_event, eventName, data) => analytics.track(eventName, data!));
  handle('analytics.identify', (_event, userId, traits) => analytics.identify(userId, traits));
  handle('analytics.getAnonymousId', () => analytics.getAnonymousId());
  handle('analytics.getProjectId', (_event, path) => analytics.getProjectId(path));

  // npm
  handle('npm.install', (_event, path, packages) => npm.install(path, packages));
  handle('npm.getOutdatedDeps', (_event, path, packages) => npm.getOutdatedDeps(path, packages));
  handle('npm.getContextFiles', (_event, path) => npm.getContextFiles(path));
}
