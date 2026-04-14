import { ipcRenderer, type IpcRendererEvent } from 'electron';

import type { DeployOptions } from '/shared/types/deploy';
import type { SceneLogSessionInfo } from '/shared/types/ipc';

import { invoke } from '../services/ipc';
import type { PreviewOptions } from '/shared/types/settings';

export type { SceneLogSessionInfo };

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

export interface ConsoleEntry {
  sessionId: number;
  timestamp: number;
  level: 'log' | 'error';
  message: string;
}

export interface MonitorStats {
  totalEntries: number;
  totalCrdt: number;
  totalOpCalls: number;
  totalConsoleLogs: number;
  activeSessions: number;
  entriesPerSecond: number;
}

export async function getSceneLogSessions(): Promise<SceneLogSessionInfo[]> {
  return invoke('sceneLog.getSessions') as Promise<SceneLogSessionInfo[]>;
}

export async function getConsoleEntries(
  afterIndex: number,
): Promise<{ entries: ConsoleEntry[]; nextIndex: number }> {
  return invoke('sceneLog.getConsoleEntries', afterIndex) as Promise<{
    entries: ConsoleEntry[];
    nextIndex: number;
  }>;
}

export async function getMonitorStats(): Promise<MonitorStats> {
  return invoke('sceneLog.getMonitorStats') as Promise<MonitorStats>;
}

export async function getRawEntries(
  afterIndex: number,
): Promise<{ entries: unknown[]; nextIndex: number }> {
  return invoke('sceneLog.getRawEntries', afterIndex) as Promise<{
    entries: unknown[];
    nextIndex: number;
  }>;
}

export async function clearSceneLogData(): Promise<void> {
  return invoke('sceneLog.clear') as Promise<void>;
}

export async function sendSceneLogCommand(
  sessionId: number,
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: unknown }> {
  return invoke('sceneLog.sendCommand', sessionId, cmd, args) as Promise<{
    ok: boolean;
    data: unknown;
  }>;
}

export async function broadcastSceneLogCommand(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: unknown }> {
  return invoke('sceneLog.broadcastCommand', cmd, args) as Promise<{
    ok: boolean;
    data: unknown;
  }>;
}

export async function startSceneLogServer(): Promise<{ port: number }> {
  return invoke('sceneLog.startServer') as Promise<{ port: number }>;
}

export async function stopSceneLogServer(): Promise<void> {
  return invoke('sceneLog.stopServer') as Promise<void>;
}

export async function getSceneLogServerStatus(): Promise<{
  running: boolean;
  port: number | null;
  sessions: number;
}> {
  return invoke('sceneLog.getServerStatus') as Promise<{
    running: boolean;
    port: number | null;
    sessions: number;
  }>;
}

export async function getStandaloneDeeplink(): Promise<{ url: string; qr: string; port: number }> {
  return invoke('sceneLog.getStandaloneDeeplink') as Promise<{
    url: string;
    qr: string;
    port: number;
  }>;
}

/** Subscribe to pushed scene log entries (real-time, no polling). */
export function onSceneLogEntries(
  callback: (data: { sessionId: number; entries: unknown[] }) => void,
): () => void {
  const handler = (_event: IpcRendererEvent, data: { sessionId: number; entries: unknown[] }) =>
    callback(data);
  ipcRenderer.on('sceneLog:entries', handler);
  return () => {
    ipcRenderer.removeListener('sceneLog:entries', handler);
  };
}
