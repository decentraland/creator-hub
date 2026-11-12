import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'recording-userdata-'));
vi.mock('electron', () => ({
  app: {
    getPath: () => userData,
    getVersion: () => '1.0.0',
    commandLine: { hasSwitch: () => false },
  },
  systemPreferences: {
    getMediaAccessStatus: () => 'granted',
    askForMediaAccess: async () => true,
  },
}));
vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const tools = vi.hoisted(() => ({
  install: vi.fn(async () => {}),
  isInstalled: vi.fn(async () => true),
  modelFor: vi.fn(() => 'en'),
}));
vi.mock('../src/modules/recording/tools', () => tools);
const transcriber = vi.hoisted(() => ({ transcribe: vi.fn() }));
vi.mock('../src/modules/recording/transcribe', () => transcriber);

import {
  abort,
  appendAudio,
  appendEvents,
  isRecording,
  start,
  stop,
  vocabularyPrompt,
} from '../src/modules/recording';

function fakeWindow(id = 1) {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { id, isDestroyed: () => false }) as never as Electron.WebContents;
}

function pcm(samples: number[]): Uint8Array {
  const buffer = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => buffer.writeInt16LE(s, i * 2));
  return new Uint8Array(buffer);
}

describe('when recording a session', () => {
  let owner: Electron.WebContents;
  let sessionId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    owner = fakeWindow();
    ({ sessionId } = await start(owner, '/scenes/My Scene', 'My Scene', 'en'));
  });

  afterEach(() => abort('test cleanup'));

  describe('and the app closes mid-recording', () => {
    let dir: string;

    beforeEach(() => {
      appendAudio(owner.id, sessionId, pcm([0, 9000, -9000, 0]), Date.now());
      appendEvents(owner.id, sessionId, [
        { t: Date.now(), kind: 'select', text: 'Selected Barrel_3 (#520)', entity: { id: 520 } },
      ]);
      const sessions = fs.readdirSync(path.join(userData, 'recordings'));
      const projectDir = path.join(userData, 'recordings', sessions[0]);
      dir = path.join(projectDir, fs.readdirSync(projectDir).sort().pop()!);
      abort('the app was closed');
    });

    it('should leave a valid WAV with everything captured', () => {
      const wav = fs.readFileSync(path.join(dir, 'audio.wav'));
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.readUInt32LE(40)).toBe(8);
      expect(wav.length).toBe(44 + 8);
    });

    it('should keep the actions and say why it was not transcribed', () => {
      expect(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8')).toContain('Barrel_3');
      const md = fs.readFileSync(path.join(dir, 'SESSION.md'), 'utf8');
      expect(md).toContain(
        'Transcription: skipped, the recording ended because the app was closed',
      );
      expect(transcriber.transcribe).not.toHaveBeenCalled();
    });

    it('should no longer be recording', () => {
      expect(isRecording()).toBe(false);
    });
  });

  describe('and the window that started it goes away', () => {
    it('should end the recording', () => {
      owner.emit('destroyed');
      expect(isRecording()).toBe(false);
    });
  });

  describe('and the in-app route changes', () => {
    it('should keep recording', () => {
      owner.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true });
      expect(isRecording()).toBe(true);
    });
  });

  describe('and another window sends data for it', () => {
    it('should ignore it', async () => {
      appendEvents(99, sessionId, [{ t: Date.now(), kind: 'click', text: 'forged' }]);
      const result = await stop(owner.id, sessionId);
      expect(result.actionCount).toBe(0);
    });
  });

  describe('and the microphone delivered pure digital silence', () => {
    it('should say the microphone looks muted or blocked', async () => {
      appendAudio(owner.id, sessionId, pcm([0, 0, 0, 0]), Date.now());
      const result = await stop(owner.id, sessionId);
      expect(transcriber.transcribe).not.toHaveBeenCalled();
      expect(result.transcriptionError).toMatch(/microphone sent only silence/);
    });
  });

  describe('and the microphone heard only silence', () => {
    it('should not run the transcriber, and still return the timeline', async () => {
      appendAudio(owner.id, sessionId, pcm([0, 3, -2, 1]), Date.now());
      appendEvents(owner.id, sessionId, [{ t: Date.now(), kind: 'click', text: 'Clicked "Play"' }]);
      const result = await stop(owner.id, sessionId);
      expect(transcriber.transcribe).not.toHaveBeenCalled();
      expect(result.transcript).toBe('');
      expect(result.context).toContain('Clicked "Play"');
    });
  });

  describe('and the user spoke', () => {
    it('should transcribe each stretch of speech with the entity names as vocabulary', async () => {
      const t = Date.now();
      // 1 s of silence, then 0.5 s of a loud tone (16 kHz)
      const tone = Array.from({ length: 8000 }, (_, i) => Math.round(12000 * Math.sin(i / 3)));
      appendAudio(owner.id, sessionId, pcm([...new Array(16000).fill(0), ...tone]), t);
      appendEvents(owner.id, sessionId, [
        {
          t,
          kind: 'viewport-hover',
          text: 'Pointer over Barrel_3',
          entity: { id: 520, name: 'Barrel_3' },
        },
      ]);
      transcriber.transcribe.mockResolvedValue([
        { start: 1000, end: 1200, text: ' delete', segment: 0 },
        { start: 1200, end: 1400, text: ' this', segment: 0 },
      ]);
      const result = await stop(owner.id, sessionId);
      const [wavPath, model, language, prompt, regions] = transcriber.transcribe.mock.calls[0];
      expect(wavPath).toMatch(/audio\.wav$/);
      expect([model, language, prompt]).toEqual(['en', 'en', 'Barrel_3']);
      expect(regions).toEqual([{ start: 790, end: 1500 }]);
      expect(result.transcript).toBe('delete this');
      expect(result.context).toContain('pointer on Barrel_3 (#520)');
    });
  });
});

describe('when building the vocabulary prompt', () => {
  it('should list the most mentioned entity names first, within 200 characters', () => {
    const events = [
      { t: 0, kind: 'hover', text: '', entity: { id: 1, name: 'Door' } },
      { t: 0, kind: 'hover', text: '', entity: { id: 2, name: 'Barrel_3' } },
      { t: 0, kind: 'hover', text: '', entity: { id: 2, name: 'Barrel_3' } },
      ...Array.from({ length: 60 }, (_, i) => ({
        t: 0,
        kind: 'hover',
        text: '',
        entity: { id: 100 + i, name: `Entity_${i}` },
      })),
    ];
    const prompt = vocabularyPrompt(events)!;
    expect(prompt.startsWith('Barrel_3, Door')).toBe(true);
    expect(prompt.length).toBeLessThanOrEqual(200);
  });
});
