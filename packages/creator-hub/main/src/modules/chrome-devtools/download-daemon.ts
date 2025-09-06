import { join } from 'path';
import * as fs from 'fs';
import { createWriteStream, promises as fsp } from 'fs';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import log from 'electron-log/main';
import { app, net } from 'electron';
import extract from 'extract-zip';

type Status = 'unavailable' | 'downloading' | 'installed';

const SERVER_DIR_PATH = join(app.getPath('userData'), 'chrome-devtools-frontend');
//TODO url from env vars
const DOWNLOAD_URL = '';

const pump = promisify(pipeline);

let currentTempFileArchive: string | null = null;

async function sleep(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

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

function tempDirPath(): string {
  return app.getPath('temp');
}

async function newTempFilePath(): Promise<string> {
  const tempDir = join(tempDirPath(), app.getName());
  await fsp.mkdir(tempDir, { recursive: true });

  const fileName = randomUUID();
  return join(tempDir, fileName) + '.tmp';
}

async function downloadDevToolsServerIfRequiredInternal(): Promise<void> {
  const initialStatus = await currentStatus();
  if (initialStatus !== 'unavailable') {
    log.info('[DAEMON] dowload is not required: ' + initialStatus);
    return;
  }

  const tempDir = tempDirPath();
  currentTempFileArchive = await newTempFilePath();

  const res = await net.fetch(DOWNLOAD_URL);
  if (!res.ok) {
    log.error(`[DAEMON] cannot download: HTTP ${res.status} ${res.statusText}`);
    return;
  }
  if (!res.body) {
    log.error('[DAEMON] cannot download: no response body');
    return;
  }

  const body = res.body as unknown as NodeReadableStream<Uint8Array>;
  const readable = Readable.fromWeb(body);
  await pump(readable, createWriteStream(currentTempFileArchive));

  // unpack archive
  const tempServerDirPath = join(tempDir, 'devtools-server-temp);');
  await fsp.mkdir(tempServerDirPath, { recursive: true });
  await extract(currentTempFileArchive, { dir: tempServerDirPath });

  // move to app dir
  await fsp.rename(tempServerDirPath, SERVER_DIR_PATH);

  // clean up temp
  await fsp.rm(currentTempFileArchive);
}

export async function downloadDevToolsServerIfRequired(): Promise<void> {
  try {
    await downloadDevToolsServerIfRequiredInternal();
  } catch (e) {
    log.info('[DAEMON] cannot download devtools server: ' + e);
  }
}

export async function waitReadyForServerPath(): Promise<string> {
  const intervalMs = 200;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await dirExists(SERVER_DIR_PATH)) return SERVER_DIR_PATH;
    await sleep(intervalMs);
  }
}
