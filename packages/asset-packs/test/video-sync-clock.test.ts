import { describe, it, expect } from 'vitest';
import {
  clockFromElapsed,
  createClock,
  getElapsedSeconds,
  pauseClock,
  resumeClock,
} from '../src/admin-toolkit-ui/video-sync-clock';

const T0 = 1_000_000;
const sec = (s: number) => s * 1000;

describe('video-sync-clock', () => {
  it('reports elapsed time since the clock started', () => {
    const clock = createClock(T0);
    expect(getElapsedSeconds(clock, T0)).toBe(0);
    expect(getElapsedSeconds(clock, T0 + sec(10))).toBe(10);
  });

  it('starting mid-video offsets the elapsed time', () => {
    const clock = createClock(T0, 30);
    expect(getElapsedSeconds(clock, T0)).toBe(30);
    expect(getElapsedSeconds(clock, T0 + sec(5))).toBe(35);
  });

  it('never reports negative elapsed time', () => {
    const clock = createClock(T0);
    expect(getElapsedSeconds(clock, T0 - sec(5))).toBe(0);
  });

  it('pausing freezes elapsed time', () => {
    const clock = pauseClock(createClock(T0), T0 + sec(10));
    expect(getElapsedSeconds(clock, T0 + sec(10))).toBe(10);
    expect(getElapsedSeconds(clock, T0 + sec(60))).toBe(10);
  });

  it('pausing an already-paused clock keeps the original freeze point', () => {
    const paused = pauseClock(createClock(T0), T0 + sec(10));
    const pausedAgain = pauseClock(paused, T0 + sec(20));
    expect(getElapsedSeconds(pausedAgain, T0 + sec(20))).toBe(10);
  });

  it('resuming continues from the frozen elapsed time', () => {
    const paused = pauseClock(createClock(T0), T0 + sec(10));
    const resumed = resumeClock(paused, T0 + sec(60));
    expect(getElapsedSeconds(resumed, T0 + sec(60))).toBe(10);
    expect(getElapsedSeconds(resumed, T0 + sec(65))).toBe(15);
  });

  it('resuming a playing clock is a no-op', () => {
    const clock = createClock(T0);
    expect(resumeClock(clock, T0 + sec(10))).toBe(clock);
  });

  it('restarting resets elapsed time to zero', () => {
    const restarted = createClock(T0 + sec(40));
    expect(getElapsedSeconds(restarted, T0 + sec(40))).toBe(0);
  });

  it('reconstructs a playing clock from a received elapsed value', () => {
    const clock = clockFromElapsed(T0, 25, true);
    expect(getElapsedSeconds(clock, T0)).toBe(25);
    expect(getElapsedSeconds(clock, T0 + sec(10))).toBe(35);
  });

  it('reconstructs a paused clock from a received elapsed value', () => {
    const clock = clockFromElapsed(T0, 25, false);
    expect(getElapsedSeconds(clock, T0 + sec(10))).toBe(25);
    const resumed = resumeClock(clock, T0 + sec(10));
    expect(getElapsedSeconds(resumed, T0 + sec(15))).toBe(30);
  });

  it('late-joiner chain stays accurate: elapsed received, re-shared later', () => {
    // Admin starts at T0. Late joiner receives elapsed=10 at its own T0+2s
    // (different machine, but only its own clock is used from here on).
    const joinerClock = clockFromElapsed(T0 + sec(2), 10, true);
    // 8 seconds later the joiner answers an even later joiner.
    expect(getElapsedSeconds(joinerClock, T0 + sec(10))).toBe(18);
  });
});
