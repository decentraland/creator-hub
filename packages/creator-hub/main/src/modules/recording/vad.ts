// Energy-based voice activity detection over the recorded PCM. Whisper's word timestamps drift
// across long silences (a word said at 6 s comes back stamped at 0 s), so the recorder finds the
// stretches of speech itself and transcribes each one at its exact offset: utterance boundaries
// then come from the audio, and word times can only be off within a short phrase.

export type SpeechRegion = { start: number; end: number };

const FRAME_MS = 30;
// Pauses shorter than this stay inside one region (breaths, commas).
const MERGE_GAP_MS = 500;
const PAD_MS = 200;
const MIN_SPEECH_MS = 200;
// Absolute floor on the speech threshold (16-bit RMS), so a near-silent room can't make its
// own hiss count as speech.
const MIN_THRESHOLD = 300;
// Speech must stand this far above the room's noise floor.
const NOISE_FACTOR = 4;

function frameRms(samples: Int16Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

export function speechRegions(samples: Int16Array, sampleRate: number): SpeechRegion[] {
  const frame = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const levels: number[] = [];
  for (let i = 0; i < samples.length; i += frame) {
    levels.push(frameRms(samples, i, Math.min(samples.length, i + frame)));
  }
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.2)];
  const threshold = Math.max(MIN_THRESHOLD, noiseFloor * NOISE_FACTOR);

  const raw: SpeechRegion[] = [];
  let open: number | null = null;
  levels.forEach((level, i) => {
    if (level >= threshold && open === null) open = i;
    if (level < threshold && open !== null) {
      raw.push({ start: open * FRAME_MS, end: i * FRAME_MS });
      open = null;
    }
  });
  if (open !== null) raw.push({ start: open * FRAME_MS, end: levels.length * FRAME_MS });

  const merged: SpeechRegion[] = [];
  for (const region of raw) {
    const last = merged[merged.length - 1];
    if (last && region.start - last.end <= MERGE_GAP_MS) last.end = region.end;
    else merged.push({ ...region });
  }
  const durationMs = (samples.length / sampleRate) * 1000;
  return merged
    .filter(r => r.end - r.start >= MIN_SPEECH_MS)
    .map(r => ({
      start: Math.max(0, r.start - PAD_MS),
      end: Math.min(durationMs, r.end + PAD_MS),
    }));
}
