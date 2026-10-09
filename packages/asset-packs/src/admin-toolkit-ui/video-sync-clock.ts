/**
 * Video Sync Clock
 *
 * Pure bookkeeping for the "play in sync for everyone" option of the admin
 * toolkit's Video URL control. Each client tracks, per synced screen, when
 * playback (would have) started on its OWN wall clock. Elapsed time is only
 * ever computed by comparing a client's clock against its own stored start
 * moment — raw timestamps are never compared across machines, so system-clock
 * skew between players cannot desync them. What travels over the wire is
 * elapsed seconds, computed by the sender at send time.
 *
 * All functions are pure and take `nowMs` explicitly so the arithmetic is
 * unit-testable without faking timers.
 */

export interface VideoSyncClock {
  /** Wall-clock ms (local) at which playback started from position 0. */
  startedAtMs: number;
  /** Elapsed seconds frozen at pause time; undefined while playing. */
  pausedAtElapsedSec?: number;
}

/** Start (or restart) a clock, optionally already `positionSec` seconds in. */
export function createClock(nowMs: number, positionSec = 0): VideoSyncClock {
  return { startedAtMs: nowMs - positionSec * 1000 };
}

/** Seconds of playback elapsed so far (frozen value while paused). */
export function getElapsedSeconds(clock: VideoSyncClock, nowMs: number): number {
  if (clock.pausedAtElapsedSec !== undefined) return clock.pausedAtElapsedSec;
  return Math.max(0, (nowMs - clock.startedAtMs) / 1000);
}

/** Freeze the clock at the current elapsed time. No-op if already paused. */
export function pauseClock(clock: VideoSyncClock, nowMs: number): VideoSyncClock {
  if (clock.pausedAtElapsedSec !== undefined) return clock;
  return { startedAtMs: clock.startedAtMs, pausedAtElapsedSec: getElapsedSeconds(clock, nowMs) };
}

/** Resume a paused clock from its frozen elapsed time. No-op if playing. */
export function resumeClock(clock: VideoSyncClock, nowMs: number): VideoSyncClock {
  if (clock.pausedAtElapsedSec === undefined) return clock;
  return createClock(nowMs, clock.pausedAtElapsedSec);
}

/**
 * Reconstruct a clock from an elapsed-seconds value received from another
 * client, so this client can in turn answer future late joiners accurately.
 */
export function clockFromElapsed(
  nowMs: number,
  elapsedSec: number,
  playing: boolean,
): VideoSyncClock {
  const clock = createClock(nowMs, elapsedSec);
  return playing ? clock : { ...clock, pausedAtElapsedSec: elapsedSec };
}
