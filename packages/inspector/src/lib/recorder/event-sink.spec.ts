import { createEventSink, type EventSink } from './event-sink';
import type { RecordedEvent } from './types';

describe('createEventSink', () => {
  let sent: RecordedEvent[][];
  let send: ReturnType<typeof vi.fn>;
  let sink: EventSink;
  let clock: number;

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    clock = 1_000;
    send = vi.fn(async (events: RecordedEvent[]) => {
      sent.push(events);
    });
  });

  afterEach(async () => {
    const stopped = sink.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    await stopped;
    vi.useRealTimers();
  });

  describe('when events are pushed within one flush interval', () => {
    beforeEach(() => {
      sink = createEventSink({ send, now: () => clock, flushIntervalMs: 500 });
      sink.push({ kind: 'click', text: 'Clicked "Play"' });
      clock = 1_100;
      sink.push({ kind: 'key', text: 'Pressed Ctrl+Z' });
    });

    it('should send nothing before the interval elapses', () => {
      vi.advanceTimersByTime(499);
      expect(send).not.toHaveBeenCalled();
    });

    it('should send them as one batch, stamped with the time they were pushed', async () => {
      await vi.advanceTimersByTimeAsync(500);
      expect(sent).toEqual([
        [
          { t: 1_000, kind: 'click', text: 'Clicked "Play"' },
          { t: 1_100, kind: 'key', text: 'Pressed Ctrl+Z' },
        ],
      ]);
    });
  });

  describe('when an event carries its own earlier time', () => {
    beforeEach(() => {
      sink = createEventSink({ send, now: () => clock });
      sink.push({ kind: 'click', text: 'second' });
      sink.push({ t: 500, kind: 'component', text: 'first (coalesced)' });
    });

    it('should keep that time and send the batch in time order', async () => {
      await sink.flush();
      expect(sent[0].map(e => e.text)).toEqual(['first (coalesced)', 'second']);
    });
  });

  describe('when an event text is long or spans lines', () => {
    beforeEach(() => {
      sink = createEventSink({ send, now: () => clock });
      sink.push({ kind: 'input', text: `Set\n"Name" to ${'x'.repeat(400)}` });
    });

    it('should send a single line of at most 200 characters', async () => {
      await sink.flush();
      const [event] = sent[0];
      expect(event.text.length).toBeLessThanOrEqual(200);
      expect(event.text).not.toContain('\n');
    });
  });

  describe('when the buffer grows past its cap', () => {
    beforeEach(() => {
      sink = createEventSink({ send, now: () => clock, maxBuffered: 3 });
      for (let i = 0; i < 5; i++) sink.push({ kind: 'click', text: `event ${i}` });
    });

    it('should keep only the newest events', async () => {
      await sink.flush();
      expect(sent[0].map(e => e.text)).toEqual(['event 2', 'event 3', 'event 4']);
    });
  });

  describe('when the sink is stopped with events still buffered', () => {
    beforeEach(() => {
      sink = createEventSink({ send, now: () => clock, flushIntervalMs: 500 });
      sink.push({ kind: 'click', text: 'last click' });
    });

    it('should flush them before resolving', async () => {
      await sink.stop();
      expect(sent).toEqual([[{ t: 1_000, kind: 'click', text: 'last click' }]]);
    });

    it('should ignore events pushed afterwards and stop its timer', async () => {
      await sink.stop();
      sink.push({ kind: 'click', text: 'too late' });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(send).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('when the host never answers', () => {
    beforeEach(() => {
      send = vi.fn(() => new Promise<void>(() => undefined));
      sink = createEventSink({
        send,
        now: () => clock,
        flushIntervalMs: 500,
        stopTimeoutMs: 2_000,
      });
      sink.push({ kind: 'click', text: 'stuck' });
    });

    it('should not start another send while one is pending', async () => {
      await vi.advanceTimersByTimeAsync(500);
      sink.push({ kind: 'click', text: 'queued' });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('should still resolve stop after the stop timeout', async () => {
      await vi.advanceTimersByTimeAsync(500);
      const stopped = sink.stop();
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(stopped).resolves.toBeUndefined();
    });
  });

  describe('when a send fails', () => {
    beforeEach(() => {
      send = vi.fn(async () => {
        throw new Error('host went away');
      });
      sink = createEventSink({ send, now: () => clock });
      sink.push({ kind: 'click', text: 'lost' });
    });

    it('should drop the batch instead of rejecting', async () => {
      await expect(sink.flush()).resolves.toBeUndefined();
      await sink.flush();
      expect(send).toHaveBeenCalledTimes(1);
    });
  });
});
