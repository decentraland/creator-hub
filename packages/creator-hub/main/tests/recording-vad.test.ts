import { describe, expect, it } from 'vitest';

import { speechRegions } from '../src/modules/recording/vad';

const RATE = 16_000;

function signal(parts: [ms: number, amplitude: number][]): Int16Array {
  const samples: number[] = [];
  for (const [ms, amplitude] of parts) {
    const n = (ms / 1000) * RATE;
    for (let i = 0; i < n; i++) samples.push(Math.round(amplitude * Math.sin(i / 3)));
  }
  return Int16Array.from(samples);
}

describe('when finding speech in a recording', () => {
  it('should return each stretch of speech, padded, at its real position', () => {
    const audio = signal([
      [6000, 0],
      [1500, 10000],
      [5000, 0],
      [2000, 10000],
      [3000, 0],
    ]);
    expect(speechRegions(audio, RATE)).toEqual([
      { start: 5800, end: 7700 },
      { start: 12280, end: 14720 },
    ]);
  });

  it('should keep a short pause inside one stretch', () => {
    const audio = signal([
      [1000, 0],
      [800, 10000],
      [300, 0],
      [800, 10000],
      [1000, 0],
    ]);
    expect(speechRegions(audio, RATE)).toHaveLength(1);
  });

  it('should ignore room noise and clicks', () => {
    const audio = signal([
      [3000, 150],
      [60, 10000],
      [3000, 150],
    ]);
    expect(speechRegions(audio, RATE)).toEqual([]);
  });

  it('should find nothing in silence', () => {
    expect(speechRegions(new Int16Array(RATE), RATE)).toEqual([]);
  });
});
