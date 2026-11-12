import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import log from 'electron-log/main';

import type { RecordingToolsStatus } from '/shared/types/recording';

import { run } from '../bin';
import basePackageJson from './tools/recording-tools.package.json?raw';

// Speech-to-text for the session recorder: whisper.cpp through `@fugood/whisper.node` (prebuilt
// N-API bindings, Metal on Apple Silicon) plus a Whisper model. Like the optimizer toolchain, none
// of it ships with the app: it is downloaded on first use into userData, after the recording
// consent dialog has said so. The package comes from a per-platform committed lockfile (`npm ci`
// installs byte-for-byte what was reviewed) and the model is pinned to a Hugging Face commit and
// checked against its SHA-256.

const lockfiles = import.meta.glob('./tools/*.package-lock.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const WHISPER_PKG = '@fugood/whisper.node';
const INSTALLED_MARKER = 'installed.json';
const INSTALL_TIMEOUT_MS = 5 * 60_000;
const MODEL_TIMEOUT_MS = 15 * 60_000;

// whisper.cpp's 8-bit quantized "small" models: ~265 MB, close to the full 466 MB model's accuracy.
// "base" (~80 MB) misheard too many words in real sessions ("piss action" for "this action");
// "large-v3-turbo" (~575 MB) was no better than small on them and four times slower. The
// English-only model is markedly better for English, so it is picked when the app is in English;
// the multilingual one otherwise.
const MODEL_COMMIT = '5359861c739e955e79d9a303bcbc70fb988958b1';
export const MODELS = {
  en: {
    file: 'ggml-small.en-q8_0.bin',
    sha256: '67a179f608ea6114bd3fdb9060e762b588a3fb3bd00c4387971be4d177958067',
    bytes: 264_477_561,
  },
  multilingual: {
    file: 'ggml-small-q8_0.bin',
    sha256: '49c8fb02b65e6049d5fa6c04f81f53b867b5ec9540406812c643f177317f779f',
    bytes: 264_464_607,
  },
} as const;
export type ModelId = keyof typeof MODELS;

// Silero voice activity detection (whisper.cpp's ggml port): finds the stretches of speech before
// Whisper sees them. Without it, mouse clicks and background noise were sent to Whisper, which
// invents text for them ("The End", "Bye!", "[BLANK_AUDIO]").
const VAD_COMMIT = '9ffd54a1e1ee413ddf265af9913beaf518d1639b';
export const VAD_MODEL = {
  file: 'ggml-silero-v5.1.2.bin',
  sha256: '29940d98d42b91fbd05ce489f3ecf7c72f0a42f027e4875919a28fb4c04ea2cf',
  bytes: 885_098,
} as const;

// The npm part is a few MB; the model dominates.
const PACKAGE_MB = 5;

export function modelFor(language: string): ModelId {
  return language.startsWith('en') ? 'en' : 'multilingual';
}

export function modelUrl(id: ModelId): string {
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/${MODEL_COMMIT}/${MODELS[id].file}`;
}

export function vadModelUrl(): string {
  return `https://huggingface.co/ggml-org/whisper-vad/resolve/${VAD_COMMIT}/${VAD_MODEL.file}`;
}

export function getToolsDir(): string {
  return path.join(app.getPath('userData'), 'recording-tools');
}

export function getModelPath(id: ModelId): string {
  return path.join(getToolsDir(), 'models', MODELS[id].file);
}

export function getVadModelPath(): string {
  return path.join(getToolsDir(), 'models', VAD_MODEL.file);
}

const platformKey = `${process.platform}-${process.arch}`;

function platformLockfile(): string | undefined {
  return lockfiles[`./tools/${platformKey}.package-lock.json`];
}

// Must produce the same dependencies scripts/lock-recording-tools.js locked for this platform.
export function platformManifest(): string {
  const base = JSON.parse(basePackageJson) as { dependencies: Record<string, string> };
  const version = base.dependencies[WHISPER_PKG];
  const manifest = {
    ...base,
    dependencies: {
      ...base.dependencies,
      [`@fugood/node-whisper-${platformKey}`]: version,
    },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

// Changes whenever the pinned package or this platform's lockfile changes, so an install made by
// an older app is redone.
function packageKey(): string {
  return crypto
    .createHash('sha256')
    .update(platformManifest())
    .update(platformLockfile() ?? '')
    .digest('hex')
    .slice(0, 16);
}

type Marker = { package?: string; models?: Partial<Record<ModelId, string>>; vad?: string };

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readMarker(): Promise<Marker> {
  try {
    return JSON.parse(await fs.readFile(path.join(getToolsDir(), INSTALLED_MARKER), 'utf8'));
  } catch {
    return {};
  }
}

async function writeMarker(patch: (marker: Marker) => Marker): Promise<void> {
  const next = patch(await readMarker());
  await fs.writeFile(path.join(getToolsDir(), INSTALLED_MARKER), JSON.stringify(next, null, 2));
}

async function isPackageInstalled(): Promise<boolean> {
  return (
    (await readMarker()).package === packageKey() &&
    (await exists(path.join(getToolsDir(), 'node_modules', WHISPER_PKG, 'package.json')))
  );
}

async function isModelInstalled(model: ModelId): Promise<boolean> {
  return (
    (await readMarker()).models?.[model] === MODELS[model].sha256 &&
    (await exists(getModelPath(model)))
  );
}

async function isVadInstalled(): Promise<boolean> {
  return (await readMarker()).vad === VAD_MODEL.sha256 && (await exists(getVadModelPath()));
}

export async function isInstalled(model: ModelId): Promise<boolean> {
  return (
    (await isPackageInstalled()) && (await isModelInstalled(model)) && (await isVadInstalled())
  );
}

export async function getStatus(model: ModelId): Promise<RecordingToolsStatus> {
  if (!platformLockfile()) {
    return { state: 'unsupported', reason: `Speech-to-text is not available on ${platformKey}.` };
  }
  if (installing) return installing.status;
  if (await isInstalled(model)) return { state: 'ready' };
  return {
    state: 'missing',
    downloadMb: PACKAGE_MB + Math.round((MODELS[model].bytes + VAD_MODEL.bytes) / 1_000_000),
  };
}

async function withTimeout<T>(
  task: Promise<T>,
  ms: number,
  message: string,
  onTimeout: () => void,
) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(message));
    }, ms);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function installPackage(dir: string): Promise<void> {
  const lockfile = platformLockfile();
  if (!lockfile) throw new Error(`Speech-to-text is not available on ${platformKey}.`);
  await fs.writeFile(path.join(dir, 'package.json'), platformManifest());
  await fs.writeFile(path.join(dir, 'package-lock.json'), lockfile);
  // --omit=optional drops the other platforms' and the CUDA/Vulkan builds the wrapper lists as
  // optional; this platform's CPU/Metal build is a direct dependency, so it stays.
  // --ignore-scripts: the bindings are prebuilt, and downloaded code must not run on install.
  const install = run('npm', 'npm', {
    args: [
      'ci',
      '--omit=optional',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--loglevel',
      'error',
    ],
    cwd: dir,
  });
  await withTimeout(
    install.wait(),
    INSTALL_TIMEOUT_MS,
    'Downloading the speech-to-text tools took too long. Check your connection.',
    () => void install.kill(),
  );
  for (const pkg of Object.keys(JSON.parse(platformManifest()).dependencies)) {
    if (!(await exists(path.join(dir, 'node_modules', pkg, 'package.json')))) {
      throw new Error(`The speech-to-text install did not produce ${pkg}`);
    }
  }
}

async function sha256Of(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk as Buffer);
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

type Download = { url: string; target: string; sha256: string; bytes: number };

async function downloadModel(
  { url, target, sha256, bytes }: Download,
  onPercent: (percent: number) => void,
): Promise<void> {
  if ((await exists(target)) && (await sha256Of(target)) === sha256) return;
  await fs.mkdir(path.dirname(target), { recursive: true });
  const partial = `${target}.download`;
  const controller = new AbortController();
  const download = (async () => {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Downloading the speech model failed (HTTP ${response.status}).`);
    }
    const total = Number(response.headers.get('content-length')) || bytes;
    const out = createWriteStream(partial);
    let received = 0;
    let lastPercent = -1;
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        received += chunk.byteLength;
        if (!out.write(chunk)) await new Promise(resolve => out.once('drain', resolve));
        const percent = Math.floor((received / total) * 100);
        if (percent !== lastPercent) {
          lastPercent = percent;
          onPercent(percent);
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        out.end((e?: Error | null) => (e ? reject(e) : resolve())),
      );
    }
  })();
  try {
    await withTimeout(
      download,
      MODEL_TIMEOUT_MS,
      'Downloading the speech model took too long. Check your connection.',
      () => controller.abort(),
    );
    const digest = await sha256Of(partial);
    if (digest !== sha256) {
      throw new Error('The downloaded speech model is corrupted (checksum mismatch). Try again.');
    }
    await fs.rename(partial, target);
  } finally {
    await fs.rm(partial, { force: true });
  }
}

// Models an older app version downloaded (e.g. the "base" models before "small") are dead weight.
async function removeStaleModels(): Promise<void> {
  const dir = path.join(getToolsDir(), 'models');
  const current = new Set<string>([...Object.values(MODELS).map(m => m.file), VAD_MODEL.file]);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  for (const entry of entries) {
    if (!entry.endsWith('.bin') || current.has(entry)) continue;
    log.info(`[Recording] removing unused speech model ${entry}`);
    await fs.rm(path.join(dir, entry), { force: true });
  }
}

let installing: { promise: Promise<void>; status: RecordingToolsStatus } | null = null;

// Idempotent and shared: a second caller while an install runs gets the same promise.
export function install(
  model: ModelId,
  onStatus: (status: RecordingToolsStatus) => void,
): Promise<void> {
  if (installing) return installing.promise;
  const report = (status: RecordingToolsStatus) => {
    if (installing) installing.status = status;
    onStatus(status);
  };
  const promise = (async () => {
    const dir = getToolsDir();
    await fs.mkdir(dir, { recursive: true });
    if (!(await isPackageInstalled())) {
      report({ state: 'installing', message: 'Downloading speech-to-text…' });
      log.info(`[Recording] installing speech-to-text package into ${dir}`);
      await installPackage(dir);
      await writeMarker(marker => ({ ...marker, package: packageKey() }));
    }
    if (!(await isModelInstalled(model))) {
      report({ state: 'installing', message: 'Downloading the speech model…', percent: 0 });
      log.info(`[Recording] downloading ${MODELS[model].file}`);
      await downloadModel(
        {
          url: modelUrl(model),
          target: getModelPath(model),
          sha256: MODELS[model].sha256,
          bytes: MODELS[model].bytes,
        },
        percent =>
          report({ state: 'installing', message: 'Downloading the speech model…', percent }),
      );
      await writeMarker(marker => ({
        ...marker,
        models: { ...marker.models, [model]: MODELS[model].sha256 },
      }));
    }
    if (!(await isVadInstalled())) {
      report({ state: 'installing', message: 'Downloading the speech detector…', percent: 0 });
      log.info(`[Recording] downloading ${VAD_MODEL.file}`);
      await downloadModel(
        { url: vadModelUrl(), target: getVadModelPath(), ...VAD_MODEL },
        percent =>
          report({ state: 'installing', message: 'Downloading the speech detector…', percent }),
      );
      await writeMarker(marker => ({ ...marker, vad: VAD_MODEL.sha256 }));
    }
    await removeStaleModels();
    log.info(`[Recording] speech-to-text ready (${MODELS[model].file})`);
  })();
  installing = { promise, status: { state: 'installing', message: 'Preparing…' } };
  promise
    .then(() => onStatus({ state: 'ready' }))
    .catch(() => undefined)
    .finally(() => {
      installing = null;
    });
  return promise;
}
