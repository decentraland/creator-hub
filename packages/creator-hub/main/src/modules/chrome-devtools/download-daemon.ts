import { join } from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Readable, Transform } from 'stream';
import { createWriteStream, promises as fsp } from 'fs';
import { pipeline } from 'stream/promises';

import log from 'electron-log/main';
import { app, net } from 'electron';

import extract from 'extract-zip';

import type { Result } from 'ts-results-es';
import { Ok, Err } from 'ts-results-es';

import { getUserDataPath } from '../electron';

const SERVER_DIR_PATH = join(getUserDataPath(), 'chrome-devtools-frontend');

type Status = 'unavailable' | 'downloading' | 'installed';

type DownloadAttepmtStatus = 'success' | 'alreadyInProgress';

export type ChromeDevToolsDownloadDaemon = {
  staticServerPath(): Promise<Result<string, string>>;

  ensureDownloaded(): Promise<Result<void, string>>;
};

export function newChromeDevToolsDownloadDaemon(): ChromeDevToolsDownloadDaemon {
  let currentTempFileArchive: string | null = null;
  let downloadLock: 'free' | 'busy' = 'free';

  async function currentStatus(): Promise<Status> {
    const exists = await dirExists(SERVER_DIR_PATH);
    if (exists) {
      return 'installed';
    }

    if (currentTempFileArchive !== null) {
      return 'downloading';
    }

    return 'unavailable';
  }

  async function waitForInstalledStatus(timeoutMs: number): Promise<Result<void, string>> {
    const intervalMs = 200;
    const start = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const status = await currentStatus();

      if (status === 'downloading') {
        await sleep(intervalMs);
      }

      if (status === 'unavailable') {
        return new Err('download operation failed');
      }

      if (status === 'installed') {
        return new Ok(undefined);
      }

      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) {
        return new Err('timeout');
      }
    }
  }

  async function cleanupTempDirForce() {
    if (currentTempFileArchive === null) {
      return;
    }

    try {
      await fsp.rm(currentTempFileArchive);
    } catch (e: unknown) {
      log.warn(`[Daemon] cannot cleanup temp dir: ${e}`);
    } finally {
      currentTempFileArchive = null;
    }
  }

  async function downloadStaticServerInternal(): Promise<Result<void, string>> {
    const tempDir = tempDirPath();
    currentTempFileArchive = await newTempFilePath();
    log.info(`[Daemon] use temp path: ${currentTempFileArchive}`);

    const urlResult = archiveDownloadUrl();
    if (urlResult.isOk() === false) {
      return new Err('Cannot download: ' + urlResult.error);
    }

    const url = urlResult.value;
    log.info(`[Daemon] downloading from url: ${url}`);
    const res = await net.fetch(url);
    if (!res.ok) {
      return new Err(`Cannot download: HTTP ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      return new Err('Cannot download: no response body');
    }

    const total: number = Number(res.headers.get('content-length') ?? 0);
    let downloaded = 0;

    const body = res.body as unknown as NodeReadableStream<Uint8Array>;
    const readable = Readable.fromWeb(body);

    const progress = new Transform({
      transform(chunk, encoding, callback) {
        downloaded += chunk.length;
        if (total) {
          const percent = ((downloaded / total) * 100).toFixed(2);
          log.info(`[Daemon] Downloading... ${percent}%`);
        } else {
          log.info(`[Daemon] Downloaded ${downloaded} bytes`);
        }
        callback(null, chunk);
      },
    });

    log.info('[Daemon] writing to disk');
    await pipeline(readable, progress, createWriteStream(currentTempFileArchive));

    log.info('[Daemon] unpacking archive');
    const tempServerDirPath = join(tempDir, 'devtools-server-temp');
    await fsp.mkdir(tempServerDirPath, { recursive: true });
    await extract(currentTempFileArchive, { dir: tempServerDirPath });

    log.info('[Daemon] copying unpacked dir');
    const archiveRoot = join(tempServerDirPath, 'front_end_backup');
    await fsp.rename(archiveRoot, SERVER_DIR_PATH);

    return new Ok(undefined);
  }

  async function downloadStaticServer(): Promise<Result<DownloadAttepmtStatus, string>> {
    if (downloadLock === 'busy') {
      return new Ok('alreadyInProgress');
    }

    try {
      downloadLock = 'busy';
      log.info('[Daemon] downloading static server');
      const result = await downloadStaticServerInternal();
      if (result.isOk()) {
        return new Ok('success');
      } else {
        return new Err(result.error);
      }
    } catch (e) {
      log.error(`[Daemon] downloading failed: ${e}`);
      return new Err(`Cannot download static server: ${e}`);
    } finally {
      await cleanupTempDirForce();
      downloadLock = 'free';
    }
  }

  async function staticServerPath(): Promise<Result<string, string>> {
    const status = await currentStatus();
    if (status !== 'installed') {
      return new Err('static server is not yet installed');
    }

    return new Ok(SERVER_DIR_PATH);
  }

  async function ensureDownloaded(): Promise<Result<void, string>> {
    const status = await currentStatus();
    log.info(`[Daemon] ensuring app has downloaded files, status: ${status}`);

    if (status === 'installed') {
      return new Ok(undefined);
    }

    if (status === 'downloading') {
      return await waitForDownloadCompletion();
    }

    if (status === 'unavailable') {
      const result = await downloadStaticServer();

      if (result.isOk() && result.value === 'alreadyInProgress') {
        return await waitForDownloadCompletion();
      }

      if (result.isOk()) {
        return new Ok(undefined);
      } else {
        return new Err(result.error);
      }
    }

    return new Err('Unknown status: ' + status);
  }

  async function waitForDownloadCompletion(): Promise<Result<void, string>> {
    const defaultTimeoutMs = 600_000; // 5 minutes
    const result = await waitForInstalledStatus(defaultTimeoutMs);
    if (result.isOk()) {
      return new Ok(undefined);
    } else {
      return new Err('Cannot download: ' + result.error);
    }
  }

  return {
    staticServerPath,
    ensureDownloaded,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}

function archiveDownloadUrl(): Result<string, string> {
  const urlFromEnv = import.meta.env.VITE_CHROME_DEVTOOLS_ARCHIVE_DOWNLOAD_URL;
  if (urlFromEnv) {
    return new Ok(urlFromEnv);
  }

  const rawArgs = process.argv;
  for (let i = 0; i < rawArgs.length - 1; i++) {
    const candidate = rawArgs[i];
    if (candidate == '--override-chrome-devtools-download-url') {
      return new Ok(rawArgs[i + 1]);
    }
  }

  return new Err('Download url is not provided niether from env var or cmd arg');
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

function tempDirPath(): string {
  return app.getPath('temp');
}

async function newTempFilePath(): Promise<string> {
  const tempDir = join(tempDirPath(), app.getName());
  await fsp.mkdir(tempDir, { recursive: true });

  const fileName = randomUUID();
  return join(tempDir, fileName) + '.tmp';
}
