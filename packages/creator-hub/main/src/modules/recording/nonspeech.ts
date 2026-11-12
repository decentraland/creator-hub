import type { TranscriptWord } from '/shared/types/recording';

// Whisper labels sounds it can't read as speech in brackets: "[BLANK_AUDIO]", "[MUSIC]",
// "(tapping)", "♪". With one segment per word those labels arrive split across several words
// (" [", "BL", "ANK", "_", "AUDIO", "]"), so brackets are tracked across words, and a bracket left
// open never swallows the next stretch of speech.
const OPEN = /[[(]/g;
const CLOSE = /[\])]/g;

export function dropNonSpeech(words: TranscriptWord[]): TranscriptWord[] {
  const kept: TranscriptWord[] = [];
  let depth = 0;
  let segment: number | undefined;
  for (const word of words) {
    if (word.segment !== segment) {
      segment = word.segment;
      depth = 0;
    }
    const opens = word.text.match(OPEN)?.length ?? 0;
    const closes = word.text.match(CLOSE)?.length ?? 0;
    const inside = depth > 0 || opens > 0 || closes > 0;
    depth = Math.max(0, depth + opens - closes);
    if (inside || /♪/.test(word.text) || word.text.trim() === '') continue;
    kept.push(word);
  }
  return kept;
}
