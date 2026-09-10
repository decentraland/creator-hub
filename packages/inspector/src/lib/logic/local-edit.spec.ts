import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { hasRecentLocalEdit, markLocalEdit } from './local-edit';

describe('when nothing has been edited yet', () => {
  it('should report no recent edit', () => {
    expect(hasRecentLocalEdit(1500)).toBe(false);
  });
});

describe('when an edit has just been marked', () => {
  beforeEach(() => {
    // `performance` is not in vitest's default toFake set, and it is the clock
    // this module reads — without it advanceTimersByTime moves nothing here.
    vi.useFakeTimers({ toFake: ['performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should report a recent edit inside the window', () => {
    markLocalEdit();

    vi.advanceTimersByTime(1499);

    expect(hasRecentLocalEdit(1500)).toBe(true);
  });

  it('should stop reporting one once the window has passed', () => {
    markLocalEdit();

    vi.advanceTimersByTime(1501);

    expect(hasRecentLocalEdit(1500)).toBe(false);
  });

  it('should extend the window on every further edit, so a burst never expires mid-way', () => {
    markLocalEdit();

    vi.advanceTimersByTime(1400);
    markLocalEdit();
    vi.advanceTimersByTime(1400);

    expect(hasRecentLocalEdit(1500)).toBe(true);
  });
});
