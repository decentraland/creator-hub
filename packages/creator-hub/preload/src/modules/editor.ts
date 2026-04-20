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

export async function getMobileDebugSessions(): Promise<MobileDebugSessionInfo[]> {
  return invoke('mobileDebug.getSessions') as Promise<MobileDebugSessionInfo[]>;
}

export async function sendMobileDebugCommand(
  sessionId: number,
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: unknown }> {
  return invoke('mobileDebug.sendCommand', sessionId, cmd, args) as Promise<{
    ok: boolean;
    data: unknown;
  }>;
}

export interface BroadcastMobileDebugResult {
  ok: boolean;
  results: { sessionId: number; ok: boolean; data: unknown }[];
}

export async function broadcastMobileDebugCommand(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<BroadcastMobileDebugResult> {
  return invoke('mobileDebug.broadcastCommand', cmd, args) as Promise<BroadcastMobileDebugResult>;
}

export async function startMobileDebugServer(): Promise<{ port: number }> {
  return invoke('mobileDebug.startServer') as Promise<{ port: number }>;
}

export async function stopMobileDebugServer(): Promise<void> {
  return invoke('mobileDebug.stopServer') as Promise<void>;
}

export async function getMobileDebugServerStatus(): Promise<{
  running: boolean;
  port: number | null;
  sessions: number;
}> {
  return invoke('mobileDebug.getServerStatus') as Promise<{
    running: boolean;
    port: number | null;
    sessions: number;
  }>;
}

export async function getStandaloneDeeplink(): Promise<{ url: string; qr: string; port: number }> {
  return invoke('mobileDebug.getStandaloneDeeplink') as Promise<{
    url: string;
    qr: string;
    port: number;
  }>;
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
