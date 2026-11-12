import { collapseWhitespace, truncate } from './text';
import { MAX_TEXT_LENGTH, type RecordedEvent, type RecordedEventInput } from './types';

export type EventSinkOptions = {
  send: (events: RecordedEvent[]) => Promise<void>;
  now?: () => number;
  flushIntervalMs?: number;
  /** Oldest events are dropped beyond this, so a host that stops answering can't grow memory. */
  maxBuffered?: number;
  /** How long `stop()` waits for the final send before giving up on a stuck host. */
  stopTimeoutMs?: number;
};

export type EventSink = {
  push(event: RecordedEventInput): void;
  flush(): Promise<void>;
  /** Flushes what is buffered, then stops the flush timer; later pushes are ignored. */
  stop(): Promise<void>;
};

export function createEventSink({
  send,
  now = Date.now,
  flushIntervalMs = 500,
  maxBuffered = 1000,
  stopTimeoutMs = 2000,
}: EventSinkOptions): EventSink {
  let buffer: RecordedEvent[] = [];
  let inFlight: Promise<void> | null = null;
  let stopped = false;

  // A tick never queues behind a pending send, so a host that stops answering costs one
  // stuck promise, not one more per tick.
  const timer = setInterval(() => {
    if (!inFlight) void flush();
  }, flushIntervalMs);

  function push(input: RecordedEventInput) {
    if (stopped) return;
    const event: RecordedEvent = {
      ...input,
      t: input.t ?? now(),
      text: truncate(collapseWhitespace(input.text), MAX_TEXT_LENGTH),
    };
    buffer.push(event);
    if (buffer.length > maxBuffered) buffer.splice(0, buffer.length - maxBuffered);
  }

  async function flush(): Promise<void> {
    // One send at a time: while the host is slow, events keep collecting in the
    // (capped) buffer and go out together with the next send.
    while (inFlight) await inFlight;
    if (buffer.length === 0) return;
    const batch = buffer.sort((a, b) => a.t - b.t);
    buffer = [];
    inFlight = Promise.resolve()
      .then(() => send(batch))
      .catch(() => {
        // A failed batch is dropped: re-queueing it would retry forever against a host
        // that can't take it, and the recording is best-effort context anyway.
      })
      .finally(() => {
        inFlight = null;
      });
    await inFlight;
  }

  async function stop() {
    if (stopped) return;
    clearInterval(timer);
    const finalFlush = flush();
    stopped = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      finalFlush,
      new Promise<void>(resolve => {
        timeout = setTimeout(resolve, stopTimeoutMs);
      }),
    ]);
    clearTimeout(timeout);
    buffer = [];
  }

  return { push, flush, stop };
}
