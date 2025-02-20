import type { DeployOptions } from '/shared/types/ipc';

import { invoke } from './invoke';

export async function getVersion() {
  return invoke('electron.getAppVersion');
}

export async function install() {
  return invoke('bin.install');
}

export async function startInspector() {
  const port = await invoke('inspector.start');
  return port;
}

export async function runScene(path: string) {
  const port = await invoke('cli.start', path);
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

export async function openCode(_path: string) {
  return invoke('bin.code', _path);
}

export async function openTutorial(opts: { id: string; list?: string }) {
  const { id, list } = opts;
  const url = `https://youtu.be/${id}${list ? `?list=${list}` : ''}`.trim();
  await invoke('electron.openExternal', url);
}
