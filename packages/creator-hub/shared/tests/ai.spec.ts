import { describe, it, expect } from 'vitest';

import { MIN_CLAUDE_CLI_VERSION, isCliVersionOutdated } from '../types/ai';

describe('isCliVersionOutdated', () => {
  const MIN = MIN_CLAUDE_CLI_VERSION;

  it('flags a version below the floor (the 2.1.39 screenshot case)', () => {
    expect(isCliVersionOutdated('2.1.39', MIN)).toBe(true);
  });

  it('accepts the floor and anything newer', () => {
    expect(isCliVersionOutdated('2.1.251', MIN)).toBe(false);
    expect(isCliVersionOutdated('2.1.260', MIN)).toBe(false);
    expect(isCliVersionOutdated('3.0.0', MIN)).toBe(false);
  });

  it('compares each segment numerically, not lexicographically', () => {
    // "39" < "251" as numbers; a string compare would wrongly rank "39" > "251".
    expect(isCliVersionOutdated('2.1.39', '2.1.251')).toBe(true);
    expect(isCliVersionOutdated('2.0.999', '2.1.0')).toBe(true);
  });

  it('never nags when the version is unknown or unparseable', () => {
    expect(isCliVersionOutdated(undefined, MIN)).toBe(false);
    expect(isCliVersionOutdated('garbage', MIN)).toBe(false);
  });

  it('tolerates trailing text around the semver (e.g. "2.1.260 (Claude Code)")', () => {
    expect(isCliVersionOutdated('2.1.39 (Claude Code)', MIN)).toBe(true);
    expect(isCliVersionOutdated('2.1.260 (Claude Code)', MIN)).toBe(false);
  });
});
