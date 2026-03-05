import { ipcRenderer, type IpcRendererEvent } from 'electron';

import type { DeployOptions } from '/shared/types/deploy';

import { invoke } from '../services/ipc';
import type { PreviewOptions } from '/shared/types/settings';

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

  const eventName = `debugger://${path}`;

  await invoke('inspector.attachSceneDebugger', path, eventName);

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

export async function detachSceneDebugger(path: string) {
  return invoke('inspector.detachSceneDebugger', path);
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
