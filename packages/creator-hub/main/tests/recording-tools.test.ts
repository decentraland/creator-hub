import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp', getVersion: () => '1.0.0' } }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/bin', () => ({ run: vi.fn() }));

import {
  MODELS,
  modelFor,
  modelUrl,
  platformManifest,
  VAD_MODEL,
  vadModelUrl,
} from '../src/modules/recording/tools';

const toolsDir = path.join(__dirname, '../src/modules/recording/tools');

describe('when installing speech-to-text on this platform', () => {
  it('should ask npm for exactly what the committed lockfile pins', () => {
    const lockfile = path.join(toolsDir, `${process.platform}-${process.arch}.package-lock.json`);
    const lock = JSON.parse(fs.readFileSync(lockfile, 'utf8'));
    expect(lock.packages[''].dependencies).toEqual(JSON.parse(platformManifest()).dependencies);
  });

  it('should make the plain CPU/Metal build a required package and every other build optional', () => {
    const lockfile = path.join(toolsDir, `${process.platform}-${process.arch}.package-lock.json`);
    const { packages } = JSON.parse(fs.readFileSync(lockfile, 'utf8'));
    const required = Object.keys(packages).filter(key => key !== '' && !packages[key].optional);
    expect(required.sort()).toEqual([
      `node_modules/@fugood/node-whisper-${process.platform}-${process.arch}`,
      'node_modules/@fugood/whisper.node',
    ]);
  });
});

describe('when picking the speech model', () => {
  it('should use the English-only model for English and the multilingual one otherwise', () => {
    expect(modelFor('en')).toBe('en');
    expect(modelFor('es')).toBe('multilingual');
    expect(modelFor('zh')).toBe('multilingual');
  });

  it('should download it from a pinned commit', () => {
    expect(modelUrl('en')).toMatch(
      /^https:\/\/huggingface\.co\/ggerganov\/whisper\.cpp\/resolve\/[0-9a-f]{40}\/ggml-small\.en-q8_0\.bin$/,
    );
    expect(MODELS.en.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('when picking the speech detector', () => {
  it('should download Silero from a pinned commit and check it', () => {
    expect(vadModelUrl()).toMatch(
      /^https:\/\/huggingface\.co\/ggml-org\/whisper-vad\/resolve\/[0-9a-f]{40}\/ggml-silero-v5\.1\.2\.bin$/,
    );
    expect(VAD_MODEL.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
