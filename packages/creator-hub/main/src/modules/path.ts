import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { type PackageJson } from '/shared/types/pkg';

/**
 * The path to the unpacked app
 */
export const APP_UNPACKED_PATH = path.join(
  app.getAppPath(),
  import.meta.env.DEV ? '../../' : '../app.asar.unpacked',
);

/**
 * Returns the path to a particular bin
 * @param pkg The name of the package
 * @param bin The name of the bin
 * @param workspace The path to the workspace, where the `node_modules` folder is located
 * @returns
 */
export function getBinPath(pkg: string, bin: string, workspace: string = APP_UNPACKED_PATH) {
  const pkgPath = path.join(workspace, './node_modules', pkg);
  let pkgJson: PackageJson;
  try {
    pkgJson = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
  } catch (error) {
    throw new Error(`Could not find package.json for module "${pkg}" in ${pkgPath}`);
  }

  if (!pkgJson.bin || !pkgJson.bin[bin]) {
    throw new Error(`Could not find bin "${bin}" in package.json for module "${pkg}"`);
  }

  return path.join(pkgPath, pkgJson.bin[bin]);
}

/**
 * Helper to get the absolute path to the node bin given the user platform
 * @returns The path to the node bin
 */
export function getNodeCmdPath() {
  const cmd = process.platform === 'win32' ? 'node.cmd' : 'node';
  return path.join(APP_UNPACKED_PATH, cmd);
}

/**
 * Path to the real Node.js binary bundled with the app, or `null` when it is not there.
 *
 * Scene tooling spawned on this instead of on Electron gets a runtime whose module ABI matches
 * the native builds its dependencies ship — notably the multiplayer server's `isolated-vm`,
 * which has no Electron build. It also makes `sdk-commands` skip its own Electron workarounds,
 * since those keys off `process.versions.electron`.
 *
 * In dev there is no bundled binary, so we fall back to whatever Node the developer already has
 * on PATH. Returns `null` if neither is available; callers then spawn the way they used to.
 *
 * TEMPORARY: goes away once the multiplayer server drops `isolated-vm` (Bevy migration).
 */
export function getBundledNodePath(): string | null {
  const binary = process.platform === 'win32' ? 'node.exe' : 'node';

  if (import.meta.env.DEV || import.meta.env.TEST) {
    return findNodeOnPath(binary);
  }

  // Node's own install layout, kept as-is so npm can derive a working global prefix from the
  // binary's location — see the note in scripts/download-node.js.
  const bundled =
    process.platform === 'win32'
      ? path.join(process.resourcesPath, 'node-bin', binary)
      : path.join(process.resourcesPath, 'node-bin', 'bin', binary);

  return fs.existsSync(bundled) ? bundled : findNodeOnPath(binary);
}

/**
 * Finds a real Node binary on PATH, skipping the `node` we install ourselves in
 * `setup-node.ts` — that one is a link to the Electron executable, which is what we are
 * trying to get away from.
 */
function findNodeOnPath(binary: string): string | null {
  const dirs = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');

  for (const dir of dirs) {
    if (!dir || path.resolve(dir) === path.resolve(APP_UNPACKED_PATH)) continue;
    const candidate = path.join(dir, binary);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // not here, keep looking
    }
  }

  return null;
}

/**
 * Combines different paths as a single env PATH using the right separator given the user's platform
 */

export function joinEnvPaths(...paths: (undefined | string)[]) {
  const separator = process.platform === 'win32' ? ';' : ':';
  return paths.filter((path): path is string => !!path).join(separator);
}
