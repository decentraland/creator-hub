import { ipcMain } from 'electron';

import { AI_STREAM_EVENT } from '/shared/types/ipc';
import { SCENE_EXPORT_PROGRESS_EVENT } from '/shared/types/scene-export';
import {
  RECORDING_AUDIO_CHANNEL,
  RECORDING_EVENTS_CHANNEL,
  RECORDING_TOOLS_PROGRESS_EVENT,
} from '/shared/types/recording';
import { handle, handleSync } from './handle';
import * as electron from './electron';
import * as updater from './updater';
import * as inspector from './inspector';
import * as bevyRealm from './bevy-realm';
import * as projectWatcher from './project-watcher';
import * as cli from './cli';
import * as bin from './bin';
import * as code from './code';
import * as analytics from './analytics';
import * as feedback from './feedback';
import * as npm from './npm';
import * as skills from './skills';
import * as config from './config';
import * as mobileDebug from './mobile-debug-server';
import * as oxc from './oxc';
import * as metrics from './metrics';
import * as ai from './ai';
import * as aiCli from './ai-cli';
import * as aiWindow from './ai-window';
import * as consoleWindow from './console-window';
import * as mcpDiscovery from './mcp-discovery';
import {
  captureViewport,
  getExternalMcpInfo,
  resolveEditorScreenshot,
  resolveSceneOp,
  resolveUserPrompt,
  revertTurn,
} from './scene-mcp';
import * as optimizer from './optimizer';
import * as recording from './recording';
import * as recordingTools from './recording/tools';
import * as sceneExport from './scene-export';
import * as landUnpublish from './land-unpublish';

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
  handle('electron.showSaveDialog', (_event, opts) => electron.showSaveDialog(opts));
  handle('electron.openExternal', (_event, url) => electron.openExternal(url));
  handle('electron.copyToClipboard', (_event, text) => electron.copyToClipboard(text));

  // analytics API (fetched here because the renderer's `Origin: null` fails CORS)
  handle('metrics.request', (_event, request) => metrics.request(request));

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
  handle('inspector.attachSceneDebugger', (event, path) =>
    inspector.attachSceneDebugger(event.sender, path),
  );
  handle('inspector.detachSceneDebugger', (event, path) =>
    inspector.detachSceneDebugger(event.sender, path),
  );

  // bevy realm (headless sdk-commands server feeding the embedded Bevy editor engine)
  handle('bevyRealm.start', (_event, path) => bevyRealm.start(path));
  handle('bevyRealm.kill', (_event, path) => bevyRealm.kill(path));

  // project asset watcher (auto-refresh the inspector catalog on out-of-editor file drops)
  handle('projectWatcher.start', async (_event, path) => projectWatcher.startProjectWatcher(path));
  handle('projectWatcher.stop', (_event, path) => projectWatcher.stopProjectWatcher(path));

  // cli
  handle('cli.init', (_event, path, repo) => cli.init(path, repo));
  handle('cli.start', (_event, path, opts, mobile) => cli.start(path, { ...opts, mobile }));
  handle('cli.deploy', (_event, opts) => cli.deploy(opts));
  handle('cli.killPreview', (_event, path) => cli.stopPreview(path));
  handle('cli.getMobilePreview', (_event, path) => cli.getMobilePreview(path));

  // mobile debug session
  handle('mobileDebug.getSessions', async () => mobileDebug.getMobileDebugSessionInfos());
  handle('mobileDebug.subscribeEntries', async event => {
    mobileDebug.subscribeEntries(event.sender);
  });
  handle('mobileDebug.unsubscribeEntries', async event => {
    mobileDebug.unsubscribeEntries(event.sender);
  });
  handle('mobileDebug.subscribeSessions', async event => {
    mobileDebug.subscribeSessions(event.sender);
  });
  handle('mobileDebug.unsubscribeSessions', async event => {
    mobileDebug.unsubscribeSessions(event.sender);
  });
  handle(
    'mobileDebug.broadcastCommand',
    async (_event, cmd: string, args: Record<string, unknown>) =>
      mobileDebug.broadcastCommand(cmd, args),
  );
  handle('mobileDebug.startServer', async () => {
    const serverPort = await mobileDebug.startMobileDebugServer();
    return { port: serverPort };
  });
  handle('mobileDebug.stopServer', async () => mobileDebug.stopMobileDebugServer());
  handle('mobileDebug.getServerStatus', async () => mobileDebug.getMobileDebugServerStatus());
  handle('mobileDebug.getStandaloneDeeplink', async () => mobileDebug.getStandaloneDeeplink());

  // config
  handle('config.getConfig', () => config.getConfig());
  handle('config.writeConfig', async (_event, _config) => {
    const wasExposed = (await config.getConfig()).settings.exposeMcpServer;
    await config.writeConfig(_config);
    // Outside access to the MCP server follows the setting, so a flip takes effect at once
    // (and revokes it when turned off). Only on a flip: most writes are about something else.
    if (_config.settings.exposeMcpServer !== wasExposed)
      void mcpDiscovery.syncExposeMcpServer(_config.settings.exposeMcpServer);
  });

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

  handle('feedback.send', (_event, report) => feedback.send(report));

  // npm
  handle('npm.install', (_event, path, packages) => npm.install(path, packages));
  handle('npm.getOutdatedDeps', (_event, path, packages) => npm.getOutdatedDeps(path, packages));
  handle('npm.getContextFiles', (_event, path) => npm.getContextFiles(path));
  handle('skills.getProjectStatus', (_event, path) => skills.getProjectSkillsStatus(path));
  handle('skills.updateProject', (_event, path) => skills.updateProjectSkills(path));

  handle('oxc.parse', (_event, filename, source) => oxc.parse(filename, source));

  // ai assistant — `ai.send` streams AiEvents back to the calling WebContents over
  // AI_STREAM_EVENT; the returned turnId lets the renderer correlate the stream.
  // Scans and turns wait out a running update of an app-installed CLI (npm removes the binary
  // before linking the new one); see detectThenUpdate / startTurnWhenIdle.
  handle('ai.detectProviders', (_event, apiKeyFromEnv) =>
    aiCli.detectThenUpdate(() => ai.detectProviders(apiKeyFromEnv), ai.aiBusy),
  );
  handle('ai.send', async (event, path, params) => {
    const sender = event.sender;
    return aiCli.startTurnWhenIdle(() =>
      ai.aiSend(params, path, e => {
        if (!sender.isDestroyed()) sender.send(AI_STREAM_EVENT, e);
      }),
    );
  });
  handle('ai.stop', async () => ai.aiStop());
  handle('ai.reset', async (_event, path) => ai.aiReset(path));
  handle('ai.deleteSession', async (_event, path, sessionId) =>
    ai.aiDeleteSession(path, sessionId),
  );
  handle('ai.isBusy', async () => ai.aiBusy());
  // AI sign-in without a CLI (#1531): install the official CLI on demand + drive its
  // subscription login; steps stream over AI_CLI_LOGIN_EVENTS.
  handle('ai.signInCli', (_event, provider) =>
    aiCli.signInCli(provider).then(() => ai.clearNeedsLogin(provider)),
  );
  handle('ai.submitSignInCode', (_event, code) => aiCli.submitSignInCode(code));
  handle('ai.cancelSignInCli', () => aiCli.cancelSignInCli());
  handle('ai.signOutCli', (_event, provider) => aiCli.signOutCli(provider));
  handle('ai.getCliState', async () => aiCli.getCliState());
  handle('ai.screenshotResult', (_event, id, dataUrl) => resolveEditorScreenshot(id, dataUrl));
  handle('ai.captureViewport', (_event, rect) => captureViewport(rect));
  handle('ai.sceneOpResult', (_event, id, ok, payload) => resolveSceneOp(id, ok, payload));
  handle('ai.askResult', (_event, id, answer) => resolveUserPrompt(id, answer));
  handle('ai.revertTurn', (_event, count) => revertTurn(count));
  // The details an agent outside the Hub connects with; null while outside access is off.
  handle('ai.getMcpServerInfo', () => getExternalMcpInfo());
  // The editor window reports which scene it has open, so the MCP server targets it and,
  // while outside access is on, Claude Code in that folder finds it (mcp-discovery).
  handle('ai.sceneOpened', (_event, path) => mcpDiscovery.sceneOpened(path));
  handle('ai.sceneClosed', async (_event, path) => mcpDiscovery.sceneClosed(path));
  handle('ai.takeExternalAccessRequest', async () => mcpDiscovery.takeExternalAccessRequest());
  // Detached AI window (#1504): lifecycle + the mirror/command relay between the two
  // renderer windows (see ai-window.ts).
  handle('ai.openWindow', (_event, locale) => aiWindow.openAiWindow(locale));
  handle('ai.closeWindow', async () => aiWindow.closeAiWindow());
  handle('ai.isWindowOpen', async () => aiWindow.isAiWindowOpen());
  handle('ai.mirrorPush', (_event, state) => aiWindow.pushMirrorState(state));
  handle('ai.remoteCommand', (_event, command) => aiWindow.forwardRemoteCommand(command));
  // Detached console window (#1272): lifecycle + the preview-running relay to it.
  handle('console.openWindow', (_event, path, locale) =>
    consoleWindow.openConsoleWindow(path, locale),
  );
  handle('console.closeWindow', async () => consoleWindow.closeConsoleWindow());
  handle('console.isWindowOpen', async () => consoleWindow.isConsoleWindowOpen());
  handle('console.mirrorPush', (_event, state) => consoleWindow.pushMirrorState(state));
  // optimizer (model/texture optimization)
  handle('optimizer.scan', (_event, path) => optimizer.scan(path));
  handle('optimizer.run', (_event, path, options) => optimizer.run(path, options));
  handle('optimizer.revert', (_event, path) => optimizer.revert(path));
  handle('optimizer.tools', () => optimizer.tools());
  handle('optimizer.installTools', (_event, path) => optimizer.installTools(path));
  // session recorder (Record button: speech + editor actions for the AI assistant)
  handle('recording.start', (event, path, title, language) =>
    recording.start(event.sender, path, title, language),
  );
  handle('recording.stop', (event, sessionId) => recording.stop(event.sender.id, sessionId));
  handle('recording.abort', async (event, sessionId) =>
    recording.abortIfOwner(event.sender.id, sessionId),
  );
  handle('recording.toolsStatus', (_event, language) =>
    recordingTools.getStatus(recordingTools.modelFor(language)),
  );
  handle('recording.installTools', (event, language) =>
    recordingTools.install(recordingTools.modelFor(language), status => {
      if (!event.sender.isDestroyed()) event.sender.send(RECORDING_TOOLS_PROGRESS_EVENT, status);
    }),
  );
  // Unlogged on purpose (see RECORDING_AUDIO_CHANNEL): raw audio and the user's actions.
  ipcMain.on(RECORDING_AUDIO_CHANNEL, (event, sessionId, pcm, firstSampleAt) =>
    recording.appendAudio(event.sender.id, sessionId, pcm, firstSampleAt),
  );
  ipcMain.on(RECORDING_EVENTS_CHANNEL, (event, sessionId, events) =>
    recording.appendEvents(event.sender.id, sessionId, events),
  );

  handle('sceneExport.export', (event, entityId, title, source) =>
    sceneExport.saveScene(entityId, title, source, progress => {
      if (!event.sender.isDestroyed()) event.sender.send(SCENE_EXPORT_PROGRESS_EVENT, progress);
    }),
  );
  handle('sceneExport.cancel', async (_event, entityId) => sceneExport.cancelSceneExport(entityId));

  handle('landUnpublish.prepare', (_event, parcel) => landUnpublish.prepareEmptyScene(parcel));
  handle('landUnpublish.deploy', (_event, request) => landUnpublish.deployEmptyScene(request));
}
