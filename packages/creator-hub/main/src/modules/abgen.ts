import { join } from 'path';
import { existsSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import log from 'electron-log/main';
import { app } from 'electron';

import { getAvailablePort } from './port';

export type AbgenInstance = {
  port: number;
  url: string; // http://127.0.0.1:<port>
  alive: () => boolean;
  kill: () => Promise<void>;
};

const UPSTREAM_AB_CDN = 'https://ab-cdn.decentraland.org';
const READY_TIMEOUT_MS = 10_000;
const READY_POLL_INTERVAL_MS = 250;

const instances: Map<string, AbgenInstance> = new Map();

/**
 * Fixed location of the abgen binary set (the binary next to its template/ and shader/ assets):
 * `<userData>/abgen/abgen` — e.g. ~/Library/Application Support/creator-hub/abgen on macOS.
 */
export function getAbgenBinPath(): string {
  const bin = process.platform === 'win32' ? 'abgen.exe' : 'abgen';
  return join(app.getPath('userData'), 'abgen', bin);
}

export function getAbgen(projectPath: string): AbgenInstance | undefined {
  return instances.get(projectPath);
}

/**
 * Spawns an abgen server (ab-cdn-compatible asset-bundle JIT converter) for a project preview,
 * pointed at the preview server's content API. Returns null on any failure so the preview can
 * degrade to the regular raw-GLTF flow — this must never block a preview from starting.
 */
export async function startAbgenForPreview(
  projectPath: string,
  previewServerUrl: string,
): Promise<AbgenInstance | null> {
  const existing = instances.get(projectPath);
  if (existing?.alive()) {
    return existing;
  }
  instances.delete(projectPath);

  const binPath = getAbgenBinPath();
  if (!existsSync(binPath)) {
    log.warn(`[ABGen] Binary not found at ${binPath} — previewing with raw GLTFs`);
    return null;
  }

  try {
    const port = await getAvailablePort();
    const url = `http://127.0.0.1:${port}`;
    const dataDir = getAbgenDataDir(projectPath);
    const contentUrl = `${previewServerUrl}/content`;

    const child = spawn(binPath, [], {
      env: {
        ...process.env,
        HTTP_SERVER_HOST: '127.0.0.1',
        HTTP_SERVER_PORT: String(port),
        ABGEN_CATALYST_URL: contentUrl,
        ABGEN_MANIFEST_CONTENT_SERVER_URL: contentUrl,
        ABGEN_OUT_ROOT: join(dataDir, 'out'),
        ABGEN_CACHE_DIR: join(dataDir, 'cache'),
        ABGEN_INDEX_BUILD_PLATFORMS: process.platform === 'win32' ? 'windows' : 'mac',
        // The explorer requests blob names without the deps digest ({hash}_{platform}).
        ABGEN_DEPS_DIGEST: '0',
        // The preview server hashes files by path, so content can change under an unchanged
        // hash; this makes abgen re-download + digest content on manifest requests.
        ABGEN_JIT_CONTENT_DIGEST: '1',
        // optimized-assets-url re-bases ALL asset-bundle traffic (wearables/emotes included);
        // misses that aren't local scene entities read through to the production CDN.
        ABGEN_UPSTREAM_AB_CDN: UPSTREAM_AB_CDN,
      },
    });

    child.stdout?.on('data', data => log.info(`[ABGen] ${String(data).trimEnd()}`));
    child.stderr?.on('data', data => log.info(`[ABGen] ${String(data).trimEnd()}`));
    child.on('error', error => log.warn('[ABGen] Process error:', error.message));

    const instance: AbgenInstance = {
      port,
      url,
      alive: () => child.exitCode === null && !child.killed,
      kill: () => killChild(child),
    };

    if (!(await waitForReady(url, instance))) {
      log.warn('[ABGen] Server did not become ready in time, killing it');
      await instance.kill();
      return null;
    }

    instances.set(projectPath, instance);
    log.info(`[ABGen] Server ready at ${url} for project ${projectPath}`);
    return instance;
  } catch (error) {
    log.warn('[ABGen] Failed to start server:', (error as Error).message);
    return null;
  }
}

export async function killAbgen(projectPath: string) {
  const instance = instances.get(projectPath);
  instances.delete(projectPath);
  await instance?.kill().catch(() => {});
}

export async function killAllAbgen() {
  for (const path of instances.keys()) {
    await killAbgen(path);
  }
  instances.clear();
}

function getAbgenDataDir(projectPath: string): string {
  // base64url keeps the folder name filesystem-safe for any project path
  const key = Buffer.from(projectPath).toString('base64url');
  return join(app.getPath('userData'), 'abgen', 'data', key);
}

function killChild(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.killed) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 3_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function waitForReady(url: string, instance: AbgenInstance): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!instance.alive()) return false;
    try {
      const response = await fetch(`${url}/readyz`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise(resolve => setTimeout(resolve, READY_POLL_INTERVAL_MS));
  }
  return false;
}
