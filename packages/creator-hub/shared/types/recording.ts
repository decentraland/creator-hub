// Types shared across main/preload/renderer for the session recorder: the Record button that
// captures the creator's speech plus a timestamped log of what they do in the editor, so the AI
// assistant can match "delete this one" to the entity they were pointing at. Preload cannot
// import from main, so the channel names and payload shapes live here.

// One thing the user did. Produced by the inspector (UI, ECS, viewport, play mode) and by the
// Creator Hub's own window; the inspector defines an identical type on its side of the RPC.
export type RecordedEvent = {
  // Date.now() when it happened (epoch ms). Every source uses the wall clock so the inspector
  // iframe, the host window and the microphone line up without a handshake.
  t: number;
  // Short machine tag ('click', 'hover', 'select', 'viewport-hover', 'scene-click', …).
  kind: string;
  // One human-readable line that makes sense to an LLM on its own.
  text: string;
  entity?: { id: number; name?: string };
  area?: string;
  x?: number;
  y?: number;
};

// A word from the transcript, in ms from the start of the audio. `segment` is the stretch of
// speech it was transcribed in; a new stretch always starts a new utterance.
export type TranscriptWord = { start: number; end: number; text: string; segment?: number };

export type RecordingToolsStatus =
  | { state: 'ready' }
  | { state: 'missing'; downloadMb: number }
  | { state: 'installing'; message: string; percent?: number }
  | { state: 'unsupported'; reason: string };

export type RecordingStartResult = { sessionId: string };

export type RecordingResult = {
  sessionId: string;
  // The session folder (audio.wav, events.jsonl, transcript.json, SESSION.md).
  dir: string;
  durationMs: number;
  // What the user said, as plain text, to seed the composer.
  transcript: string;
  actionCount: number;
  // The condensed timeline handed to the assistant as editor context with the next message.
  context: string;
  // Set when the audio could not be transcribed; the timeline still has every action.
  transcriptionError?: string;
};

// Fire-and-forget channels (ipcRenderer.send): audio chunks and event batches arrive many times
// a second, and the generic `handle` wrapper logs every argument to the app log — a privacy and
// size problem for raw audio and a log of the user's actions.
export const RECORDING_AUDIO_CHANNEL = 'recording.audio';
export const RECORDING_EVENTS_CHANNEL = 'recording.events';
export const RECORDING_TOOLS_PROGRESS_EVENT = 'recording.toolsProgress';

// The recorder captures 16 kHz mono 16-bit PCM: what Whisper consumes, and ~32 KB/s.
export const RECORDING_SAMPLE_RATE = 16_000;

// The transcription worker (main/src/transcribe-worker.ts): job in TRANSCRIBE_JOB, one JSON
// message per stdout line back.
export type TranscribeWorkerJob = {
  modelPath: string;
  wavPath: string;
  language: string;
  // Whisper's initial prompt: vocabulary to bias toward (entity names, editor terms).
  prompt?: string;
  // Silero VAD model: when set, the worker finds the speech with it and `regions` is only the
  // fallback for when the detector fails.
  vadModelPath?: string;
  // Stretches of speech (ms) to transcribe one by one; the whole file when absent.
  regions?: { start: number; end: number }[];
};

export type TranscribeWorkerMessage =
  | { type: 'progress'; percent: number }
  | { type: 'result'; words: TranscriptWord[] }
  | { type: 'error'; message: string };
