import type { DeployOptions } from '/shared/types/ipc';
import { invoke } from './invoke';

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

export async function publishScene(opts: DeployOptions) {
  const port = await invoke('cli.deploy', opts);
  return port;
}

export async function openPreview(port: number) {
  const url = `http://localhost:${port}`;
  await invoke('electron.openExternal', url);
}
