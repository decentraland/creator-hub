import fs from 'node:fs/promises';
import { promisify } from 'util';
import { exec as execSync } from 'child_process';
import { shell } from 'electron';
import path from 'path';

import type { DeployOptions } from '/shared/types/ipc';
import { invoke } from './invoke';

const exec = promisify(execSync);

export async function getEditorHome(_path: string) {
  const editorHomePath = path.join(_path, '.editor');
  try {
    await fs.stat(editorHomePath);
  } catch (_) {
    await fs.mkdir(editorHomePath);
  }
  return editorHomePath;
}

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

export async function publishScene(opts: DeployOptions) {
  const port = await invoke('cli.deploy', opts);
  return port;
}

export async function openPreview(port: number) {
  const url = `http://localhost:${port}`;
  await invoke('electron.openExternal', url);
}

export async function openCode(_path: string) {
  const normalPath = path.normalize(_path);
  try {
    await exec(`code "${normalPath}"`);
  } catch (_) {
    await shell.openPath(normalPath);
  }
}
