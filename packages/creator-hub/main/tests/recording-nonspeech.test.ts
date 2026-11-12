import { describe, expect, it } from 'vitest';

import type { TranscriptWord } from '/shared/types/recording';
import { dropNonSpeech } from '../src/modules/recording/nonspeech';

function words(texts: string[], segment = 0): TranscriptWord[] {
  return texts.map((text, i) => ({ start: i * 100, end: i * 100 + 90, text, segment }));
}

const text = (list: TranscriptWord[]) => list.map(w => w.text).join('');

describe('when the transcript contains labels for sounds that are not speech', () => {
  it('should drop a label split across several words', () => {
    expect(dropNonSpeech(words([' [', 'BL', 'ANK', '_', 'AUDIO', ']']))).toEqual([]);
  });

  it('should drop parenthesised sounds and music notes but keep the speech around them', () => {
    const list = words([' Make', ' (', 'tapping', ')', ' this', ' ♪', ' bigger', '.']);
    expect(text(dropNonSpeech(list))).toBe(' Make this bigger.');
  });

  it('should not let a bracket left open swallow the next stretch of speech', () => {
    const list = [...words([' [', 'MUSIC'], 0), ...words([' Delete', ' this', ' one'], 1)];
    expect(text(dropNonSpeech(list))).toBe(' Delete this one');
  });

  it('should keep ordinary speech untouched', () => {
    const list = words([' Okay', ',', ' delete', ' this', ' one', '.']);
    expect(dropNonSpeech(list)).toEqual(list);
  });
});
