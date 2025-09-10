import { join } from 'path';
import * as fs from 'fs';
import { createWriteStream, promises as fsp } from 'fs';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { app, net } from 'electron';
import extract from 'extract-zip';
import type { Result } from 'ts-results-es';
import { Ok, Err } from 'ts-results-es';

const SERVER_DIR_PATH = join(app.getPath('userData'), 'chrome-devtools-frontend');

type Status = 'unavailable' | 'downloading' | 'installed';

export type ChromeDevToolsDownloadDaemon = {
  staticServerPath(): Promise<Result<string, string>>;

  ensureDownloaded(): Promise<Result<void, string>>;
};

export function newChromeDevToolsDownloadDaemon(): ChromeDevToolsDownloadDaemon {
  let currentTempFileArchive: string | null = null;

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
      if (status !== 'installed') {
        await sleep(intervalMs);
      } else {
        return new Ok(undefined);
      }

      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) {
        return new Err('timeout');
      }
    }
  }

  async function downloadStaticServer(): Promise<Result<void, string>> {
    const tempDir = tempDirPath();
    currentTempFileArchive = await newTempFilePath();

    const urlResult = archiveDownloadUrl();
    if (urlResult.isOk() === false) {
      return new Err('cannot download: ' + urlResult.error);
    }

    const res = await net.fetch(urlResult.value);
    if (!res.ok) {
      return new Err(`cannot download: HTTP ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      return new Err('cannot download: no response body');
    }

    const body = res.body as unknown as NodeReadableStream<Uint8Array>;
    const readable = Readable.fromWeb(body);
    await pump(readable, createWriteStream(currentTempFileArchive));

    // unpack archive
    const tempServerDirPath = join(tempDir, 'devtools-server-temp');
    await fsp.mkdir(tempServerDirPath, { recursive: true });
    await extract(currentTempFileArchive, { dir: tempServerDirPath });

    // move to app dir
    await fsp.rename(tempServerDirPath, SERVER_DIR_PATH);

    // clean up temp
    await fsp.rm(currentTempFileArchive);
    return new Ok(undefined);
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

    if (status === 'installed') {
      return new Ok(undefined);
    }

    if (status === 'downloading') {
      const defaultTimeoutMs = 600_000; // 5 minutes
      const result = await waitForInstalledStatus(defaultTimeoutMs);
      if (result.isOk()) {
        return new Ok(undefined);
      } else {
        return new Err('Cannot download: ' + result.error);
      }
    }

    if (status === 'unavailable') {
      const result = await downloadStaticServer();
      return result;
    }

    return new Err('Unknown status: ' + status);
  }

  return {
    staticServerPath,
    ensureDownloaded,
  };
}

const pump = promisify(pipeline);

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
