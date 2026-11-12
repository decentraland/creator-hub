// `@fugood/whisper.node` is not an app dependency: the session recorder downloads it on first use
// (main/src/modules/recording/tools.ts) and only the transcription worker imports it, at runtime,
// from that download. This declares the slice of its API the worker uses.
declare module '@fugood/whisper.node' {
  export type WhisperSegment = { text: string; t0: number; t1: number };
  export type WhisperContext = {
    transcribeFile(
      path: string,
      options: {
        language?: string;
        maxLen?: number;
        tokenTimestamps?: boolean;
        temperature?: number;
        prompt?: string;
        offset?: number;
        duration?: number;
        onProgress?: (percent: number) => void;
      },
    ): { stop: () => Promise<void>; promise: Promise<{ segments: WhisperSegment[] }> };
    transcribeData(
      audio: ArrayBuffer,
      options: {
        language?: string;
        maxLen?: number;
        tokenTimestamps?: boolean;
        temperature?: number;
        prompt?: string;
      },
    ): { stop: () => Promise<void>; promise: Promise<{ segments: WhisperSegment[] }> };
    release(): Promise<void>;
  };
  export function initWhisper(options: {
    filePath: string;
    useGpu?: boolean;
  }): Promise<WhisperContext>;
  export type WhisperVadContext = {
    detectSpeechData(
      audio: ArrayBuffer,
      options?: {
        threshold?: number;
        minSpeechDurationMs?: number;
        minSilenceDurationMs?: number;
        speechPadMs?: number;
      },
    ): Promise<{ t0: number; t1: number }[]>;
    release(): Promise<void>;
  };
  export function initWhisperVad(options: {
    filePath: string;
    useGpu?: boolean;
    nThreads?: number;
  }): Promise<WhisperVadContext>;
}
