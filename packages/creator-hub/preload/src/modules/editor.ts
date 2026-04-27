import { ipcRenderer, type IpcRendererEvent } from 'electron';

import type { DeployOptions } from '/shared/types/deploy';
import type { MobileDebugSessionInfo } from '/shared/types/ipc';

import { invoke } from '../services/ipc';
import type { PreviewOptions } from '/shared/types/settings';

export type { MobileDebugSessionInfo };

export async function getVersion() {
  return invoke('electron.getAppVersion');
}

export async function install() {
  return invoke('bin.install');
}

export async function openCode(_path: string) {
  return invoke('code.open', _path);
}

export async function startInspector() {
  const port = await invoke('inspector.start');
  return port;
}

const activeDebuggers = new Map<string, () => void>();

export async function attachSceneDebugger(
  path: string,
  cb: (data: string) => void,
): Promise<{ cleanup: () => void }> {
  // Clean up any previous debugger for this path (handles React StrictMode double-mount)
  activeDebuggers.get(path)?.();

  const eventName = await invoke('inspector.attachSceneDebugger', path);

  const handler = (_: IpcRendererEvent, data: string) => cb(data);
  ipcRenderer.on(eventName, handler);

  const cleanup = () => {
    ipcRenderer.off(eventName, handler);
    activeDebuggers.delete(path);
    invoke('inspector.detachSceneDebugger', path);
  };

  activeDebuggers.set(path, cleanup);

  return { cleanup };
}

export async function runScene({ path, opts }: { path: string; opts: PreviewOptions }) {
  const port = await invoke('cli.start', path, opts);
  return port;
}

export async function killPreviewScene(path: string) {
  const port = await invoke('cli.killPreview', path);
  return port;
}

export async function publishScene(opts: DeployOptions) {
  const port = await invoke('cli.deploy', opts);
  return port;
}

export async function openPreview(port: number) {
  const url = `http://localhost:${port}`;
  await invoke('electron.openExternal', url);
}

export async function openTutorial(opts: { id: string; list?: string }) {
  const { id, list } = opts;
  const url = `https://youtu.be/${id}${list ? `?list=${list}` : ''}`.trim();
  await invoke('electron.openExternal', url);
}

export async function openExternalURL(url: string) {
  await invoke('electron.openExternal', url);
}

export async function getMobilePreview(path: string) {
  return invoke('cli.getMobilePreview', path);
}

export async function getMobileDebugSessions() {
  return invoke('mobileDebug.getSessions');
}

export async function broadcastMobileDebugCommand(cmd: string, args: Record<string, unknown> = {}) {
  return invoke('mobileDebug.broadcastCommand', cmd, args);
}

export async function startMobileDebugServer() {
  return invoke('mobileDebug.startServer');
}

export async function stopMobileDebugServer() {
  return invoke('mobileDebug.stopServer');
}

export async function getMobileDebugServerStatus() {
  return invoke('mobileDebug.getServerStatus');
}

export async function getStandaloneDeeplink() {
  return invoke('mobileDebug.getStandaloneDeeplink');
}

export function onMobileDebugEntries(
  callback: (data: { sessionId: number; entries: unknown[] }) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, data: { sessionId: number; entries: unknown[] }) =>
    callback(data);
  ipcRenderer.on('mobileDebug:entries', handler);
  void invoke('mobileDebug.subscribeEntries');
  return () => {
    ipcRenderer.removeListener('mobileDebug:entries', handler);
    void invoke('mobileDebug.unsubscribeEntries');
  };
}

export function onMobileDebugSessions(
  callback: (sessions: MobileDebugSessionInfo[]) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, sessions: MobileDebugSessionInfo[]) =>
    callback(sessions);
  ipcRenderer.on('mobileDebug:sessions', handler);
  void invoke('mobileDebug.subscribeSessions');
  return () => {
    ipcRenderer.removeListener('mobileDebug:sessions', handler);
    void invoke('mobileDebug.unsubscribeSessions');
  };
}
