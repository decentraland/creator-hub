import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import log from 'electron-log/main';

import {
  OPTIMIZE_PROGRESS_EVENT,
  type OptimizeOptions,
  type OptimizeProgress,
  type OptimizeResult,
  type OptimizeToolsInfo,
  type OptimizeWorkerJob,
} from '/shared/types/optimizer';

import { MAIN_WINDOW_ID } from '../../mainWindow';
import { run as runBin } from '../bin';
import { getBundledNodePath } from '../path';
import { getWindow } from '../window';
import { readManifest, revertFromManifest } from './backup';
import { createWorkerOutputReader } from './protocol';
import { scan } from './scan';
import { getToolsDir, getToolsInfo, installTools as installToolchain } from './tools';

export { scan };

// Host side of the optimizer. The heavy pipeline (pipeline.ts) runs in a worker child process on
// the bundled real Node, with the downloaded toolchain on its module path; this module only
// installs that toolchain, spawns the worker, relays its progress to the renderer, and handles
// the fs-only operations (scan, revert) itself.

const WORKER_PKG = '@dcl-creator-hub/optimizer-worker';
const WORKER_BIN = 'optimizer-worker';

function emitProgress(projectPath: string, progress: Omit<OptimizeProgress, 'path'>): void {
  const window = getWindow(MAIN_WINDOW_ID);
  if (window && !window.isDestroyed()) {
    const payload: OptimizeProgress = { path: projectPath, ...progress };
    window.webContents.send(OPTIMIZE_PROGRESS_EVENT, payload);
  }
}

export async function tools(): Promise<OptimizeToolsInfo> {
  return getToolsInfo();
}

export async function installTools(projectPath: string): Promise<OptimizeToolsInfo> {
  await installToolchain(message =>
    emitProgress(projectPath, { phase: 'install', current: 0, total: 0, message }),
  );
  return getToolsInfo();
}

// The worker bundle is copied out of the app on every run into a package under the tools dir:
// real Node cannot execute a file inside the asar, and Node resolves `sharp` & co. by walking
// up from the script's own directory, so living under <tools>/node_modules is what puts the
// downloaded toolchain in scope. `npm ci` wipes node_modules, hence the copy is per run.
async function ensureWorkerPackage(): Promise<void> {
  const source = path.join(app.getAppPath(), 'main', 'dist', 'optimizer-worker.js');
  const pkgDir = path.join(getToolsDir(), 'node_modules', ...WORKER_PKG.split('/'));
  await fs.mkdir(pkgDir, { recursive: true });
  await fs.copyFile(source, path.join(pkgDir, 'index.js'));
  await fs.writeFile(
    path.join(pkgDir, 'package.json'),
    JSON.stringify(
      {
        name: WORKER_PKG,
        version: app.getVersion(),
        private: true,
        type: 'module',
        bin: { [WORKER_BIN]: 'index.js' },
      },
      null,
      2,
    ),
  );
}

// Resolves once the worker's stdout has delivered everything: 'exit' can fire before the last
// chunk (the result line) is read, so waiting on the process alone is not enough.
function stdoutDrained(stream: NodeJS.ReadableStream | null): Promise<void> {
  return new Promise(resolve => {
    if (!stream) return resolve();
    const done = () => resolve();
    stream.once('end', done);
    stream.once('close', done);
    setTimeout(done, 2000);
  });
}

export async function run(projectPath: string, options: OptimizeOptions): Promise<OptimizeResult> {
  const info = await getToolsInfo();
  if (info.status !== 'ready') throw new Error('The optimizer tools are not installed yet.');
  await ensureWorkerPackage();

  const job: OptimizeWorkerJob = { command: 'run', projectPath, options };
  const toolsDir = getToolsDir();
  const child = runBin(WORKER_PKG, WORKER_BIN, {
    workspace: toolsDir,
    cwd: toolsDir,
    nodePath: getBundledNodePath(),
    env: { OPTIMIZER_JOB: JSON.stringify(job) },
  });

  let result: OptimizeResult | null = null;
  let failure: string | null = null;

  const reader = createWorkerOutputReader({
    onLog: line => log.info(`[Optimizer] ${line}`),
    onMessage: message => {
      if (message.type === 'progress') emitProgress(projectPath, message.progress);
      else if (message.type === 'result') result = message.result;
      else if (message.type === 'error') failure = message.message;
    },
  });
  child.process.stdout?.on('data', (chunk: Buffer) => reader.push(chunk));

  try {
    await child.wait();
  } catch (error) {
    await stdoutDrained(child.process.stdout);
    reader.flush();
    throw new Error(failure ?? (error instanceof Error ? error.message : String(error)));
  }
  await stdoutDrained(child.process.stdout);
  reader.flush();

  if (failure) throw new Error(failure);
  if (!result) throw new Error('The optimizer worker exited without a result.');
  return result;
}

export async function revert(projectPath: string): Promise<{ restored: number }> {
  const manifest = await readManifest(projectPath);
  if (!manifest) return { restored: 0 };
  const restored = await revertFromManifest(projectPath, manifest);
  return { restored };
}
