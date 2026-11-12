import fs from 'node:fs/promises';
import type * as WhisperNodeModule from '@fugood/whisper.node';

import {
  RECORDING_SAMPLE_RATE,
  type TranscribeWorkerJob,
  type TranscribeWorkerMessage,
  type TranscriptWord,
} from '/shared/types/recording';

const WAV_HEADER_BYTES = 44;
const BYTES_PER_MS = (RECORDING_SAMPLE_RATE * 2) / 1000;

// Silero's defaults clip the first word of a sentence ("Change the sound effect…" came back as
// "the sound effect…"), so it gets a lower threshold and more padding. A 500 ms pause ends a
// stretch: shorter ones are breaths and commas, and whole sentences transcribe better than pieces.
const VAD_OPTIONS = {
  threshold: 0.4,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 500,
  speechPadMs: 400,
};

// Entry of the session recorder's transcription worker: a separate bundle
// (main/vite.worker.config.js) that the host (modules/recording/transcribe.ts) copies next to the
// downloaded `@fugood/whisper.node` and runs on the bundled real Node, so a native crash in
// whisper.cpp can't take the app down. The job arrives in TRANSCRIBE_JOB; progress, the words and
// errors go back as one JSON object per stdout line.

type Region = { start: number; end: number };
type WhisperNode = typeof WhisperNodeModule;

function send(message: TranscribeWorkerMessage): Promise<void> {
  return new Promise(resolve => {
    process.stdout.write(`${JSON.stringify(message)}\n`, () => resolve());
  });
}

// The stretches of speech according to Silero, or null when it can't run (then the host's
// loudness-based regions are used). An empty list is an answer: nothing in the recording is speech.
async function detectSpeech(
  whisper: WhisperNode,
  job: TranscribeWorkerJob,
  pcm: ArrayBuffer,
): Promise<Region[] | null> {
  if (!job.vadModelPath) return null;
  try {
    // CPU only: this build's Metal backend aborts the process while setting the VAD graph up, and
    // the model is small enough that the CPU takes a fraction of a second.
    const vad = await whisper.initWhisperVad({
      filePath: job.vadModelPath,
      useGpu: false,
      nThreads: 4,
    });
    try {
      const segments = await vad.detectSpeechData(pcm, VAD_OPTIONS);
      // Silero reports centiseconds.
      return segments.map(s => ({ start: s.t0 * 10, end: s.t1 * 10 }));
    } finally {
      await vad.release();
    }
  } catch (error) {
    process.stderr.write(`speech detection failed, using the loudness regions: ${String(error)}\n`);
    return null;
  }
}

async function main(): Promise<void> {
  const raw = process.env.TRANSCRIBE_JOB;
  if (!raw) throw new Error('TRANSCRIBE_JOB is not set');
  const job = JSON.parse(raw) as TranscribeWorkerJob;
  // Resolved at runtime from the tools dir this bundle is copied into (never bundled).
  const whisper = await import('@fugood/whisper.node');
  const file = await fs.readFile(job.wavPath);
  const pcm = file.buffer.slice(
    file.byteOffset + WAV_HEADER_BYTES,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
  const regions = (await detectSpeech(whisper, job, pcm)) ?? job.regions;
  if (regions?.length === 0) {
    await send({ type: 'result', words: [] });
    return;
  }

  const context = await whisper.initWhisper({ filePath: job.modelPath, useGpu: true });
  try {
    // maxLen 1 + token timestamps = one segment per word, with its own start/end (ms): the
    // granularity needed to line "this" up with what the pointer was on.
    const options = {
      language: job.language,
      maxLen: 1,
      tokenTimestamps: true,
      temperature: 0,
      prompt: job.prompt,
    };
    const words: TranscriptWord[] = [];
    if (!regions) {
      const { segments } = await context.transcribeFile(job.wavPath, options).promise;
      words.push(...segments.map(s => ({ start: s.t0, end: s.t1, text: s.text })));
    } else {
      // Each stretch of speech goes in as its own clip. Pointing Whisper at an offset of the
      // whole file isn't enough: it decodes a 30 s window and reads ahead into later speech.
      for (const [index, region] of regions.entries()) {
        const from = Math.floor((region.start * BYTES_PER_MS) / 2) * 2;
        const to = Math.min(pcm.byteLength, Math.floor((region.end * BYTES_PER_MS) / 2) * 2);
        if (to <= from) continue;
        const { segments } = await context.transcribeData(pcm.slice(from, to), options).promise;
        for (const s of segments) {
          words.push({
            start: region.start + s.t0,
            end: Math.min(region.end, region.start + s.t1),
            text: s.text,
            segment: index,
          });
        }
        await send({
          type: 'progress',
          percent: Math.round(((index + 1) / regions.length) * 100),
        });
      }
    }
    await send({ type: 'result', words });
  } finally {
    await context.release();
  }
}

main().catch(async error => {
  await send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
