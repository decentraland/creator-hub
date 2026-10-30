import fs from 'node:fs';
import path from 'node:path';
import log from 'electron-log/main';
import { APP_UNPACKED_PATH, getBinPath, joinEnvPaths } from './path';

export type NodeRuntimeSource = 'bundled' | 'system' | 'electron';

export type NodeRuntime = {
  source: NodeRuntimeSource;
  node: string;
  binDir: string;
  npmCli: string;
  npxCli: string;
};

const IS_WINDOWS = process.platform === 'win32';
const NODE_BINARY = IS_WINDOWS ? 'node.exe' : 'node';

function npmCliDir(node: string) {
  const prefix = IS_WINDOWS ? path.dirname(node) : path.dirname(path.dirname(node));
  return path.join(prefix, ...(IS_WINDOWS ? [] : ['lib']), 'node_modules', 'npm', 'bin');
}

function getNodeRuntime(source: 'bundled' | 'system', node: string): NodeRuntime {
  const npmDir = npmCliDir(node);
  const shipsNpm = fs.existsSync(path.join(npmDir, 'npm-cli.js'));
  return {
    source,
    node,
    binDir: path.dirname(node),
    npmCli: shipsNpm ? path.join(npmDir, 'npm-cli.js') : getBinPath('npm', 'npm'),
    npxCli: shipsNpm ? path.join(npmDir, 'npx-cli.js') : getBinPath('npm', 'npx'),
  };
}

function findNodeOnPath(): string | null {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir || path.resolve(dir) === path.resolve(APP_UNPACKED_PATH)) continue;
    const candidate = path.join(dir, NODE_BINARY);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function getBundledNodePath(): string | null {
  const bundled = path.join(
    process.resourcesPath,
    'node-bin',
    ...(IS_WINDOWS ? [NODE_BINARY] : ['bin', NODE_BINARY]),
  );
  return fs.existsSync(bundled) ? bundled : null;
}

/**
 * Picks the Node runtime every child process (sdk-commands, npm, npx, ...) runs on: the
 * bundled `node-bin`, else a real Node on PATH, else Electron itself with `ELECTRON_RUN_AS_NODE`.
 * In development the bundle does not exist, so the developer's own Node is used.
 */
export function resolveNodeRuntime(): NodeRuntime {
  if (import.meta.env.DEV || import.meta.env.TEST) {
    const devNode = findNodeOnPath();
    return devNode ? getNodeRuntime('system', devNode) : getElectronRuntime();
  }

  const bundled = getBundledNodePath();
  if (bundled) return getNodeRuntime('bundled', bundled);

  const systemNode = findNodeOnPath();
  if (systemNode) {
    log.warn(`[NodeRuntime] Bundled Node not found, using system Node at ${systemNode}`);
    return getNodeRuntime('system', systemNode);
  }

  log.warn('[NodeRuntime] Bundled Node not found and no Node on PATH, using Electron as Node');
  return getElectronRuntime();
}

function getElectronRuntime(): NodeRuntime {
  return {
    source: 'electron',
    node: process.execPath,
    binDir: APP_UNPACKED_PATH,
    npmCli: getBinPath('npm', 'npm'),
    npxCli: getBinPath('npm', 'npx'),
  };
}

/**
 * Env for a child running on `runtime`: the runtime's bin dir leads PATH so `node`, `npm` and
 * `npx` resolve to it, followed by the app's node shim dir and the OS PATH.
 */
export function getChildEnv(
  runtime: NodeRuntime,
  extra: Record<string, string> = {},
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...extra,
    PATH: joinEnvPaths(runtime.binDir, APP_UNPACKED_PATH, process.env.PATH),
  };
  if (runtime.source === 'electron') {
    env.ELECTRON_RUN_AS_NODE = '1';
  } else {
    delete env.ELECTRON_RUN_AS_NODE;
  }
  return env;
}

/** Script a child should run for `pkg`'s `bin`: npm and npx come from the runtime, anything else from the workspace. */
export function resolveBin(
  runtime: NodeRuntime,
  pkg: string,
  bin: string,
  workspace?: string,
): string {
  if (pkg !== 'npm') return getBinPath(pkg, bin, workspace);
  return bin === 'npx' ? runtime.npxCli : runtime.npmCli;
}
