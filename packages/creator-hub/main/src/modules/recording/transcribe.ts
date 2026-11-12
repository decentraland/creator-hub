import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import log from 'electron-log/main';

import type {
  TranscribeWorkerJob,
  TranscribeWorkerMessage,
  TranscriptWord,
} from '/shared/types/recording';

import { StreamError, run as runBin } from '../bin';
import { getModelPath, getToolsDir, getVadModelPath, isInstalled, type ModelId } from './tools';

const WORKER_PKG = '@dcl-creator-hub/transcribe-worker';
const WORKER_BIN = 'transcribe-worker';
// Generous: a long session on an Intel Mac without Metal transcribes at a few times real time.
const TRANSCRIBE_TIMEOUT_MS = 10 * 60_000;

// Copied out of the app on every run, as the optimizer does with its worker: real Node can't run
// a file inside the asar, and resolving `@fugood/whisper.node` walks up from the script's own
// directory, so it must live under <tools>/node_modules.
async function ensureWorkerPackage(): Promise<void> {
  const source = path.join(app.getAppPath(), 'main', 'dist', 'transcribe-worker.js');
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

export function parseWorkerOutput(stdout: Buffer | string): TranscribeWorkerMessage[] {
  return stdout
    .toString()
    .split(/\r?\n/)
    .flatMap(line => {
      if (!line.startsWith('{')) return [];
      try {
        return [JSON.parse(line) as TranscribeWorkerMessage];
      } catch {
        return [];
      }
    });
}

export async function transcribe(
  wavPath: string,
  model: ModelId,
  language: string,
  prompt: string | undefined,
  regions?: TranscribeWorkerJob['regions'],
): Promise<TranscriptWord[]> {
  if (!(await isInstalled(model))) throw new Error('Speech-to-text is not installed yet.');
  await ensureWorkerPackage();
  const job: TranscribeWorkerJob = {
    modelPath: getModelPath(model),
    vadModelPath: getVadModelPath(),
    wavPath,
    language,
    prompt,
    regions,
  };
  const toolsDir = getToolsDir();
  const child = runBin(WORKER_PKG, WORKER_BIN, {
    workspace: toolsDir,
    cwd: toolsDir,
    env: { TRANSCRIBE_JOB: JSON.stringify(job) },
  });

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void child.kill();
      reject(new Error('Transcription took too long.'));
    }, TRANSCRIBE_TIMEOUT_MS);
  });

  // Read the outcome from the complete buffer, not the live stream: `bin` can drop the last
  // chunk on exit (see the optimizer's runWorker).
  let stdout: Buffer;
  let failure: string | null = null;
  try {
    stdout = await Promise.race([child.wait(), timeout]);
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
    stdout = error.stdout;
    const stderr = error.stderr.toString('utf8').trim();
    if (stderr) log.error(`[Recording] transcribe worker stderr:\n${stderr}`);
    failure = stderr.split(/\r?\n/).slice(-3).join('\n') || error.message;
  } finally {
    clearTimeout(timer);
  }

  const messages = parseWorkerOutput(stdout);
  const error = messages.find(m => m.type === 'error');
  if (error?.type === 'error') throw new Error(error.message);
  const result = messages.find(m => m.type === 'result');
  if (result?.type === 'result') return result.words;
  throw new Error(failure ?? 'The transcription worker exited without a result.');
}
