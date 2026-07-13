import { createModifierTracker } from './modifier-tracker';

/**
 * The modifier tracker remembers whether a multi-select modifier (Shift / Ctrl /
 * Cmd) is held, from key events on BOTH the host and the same-origin engine
 * window — so a viewport pick (which the agent reports without DOM modifiers) can
 * become a multi-select. Driven with fake windows that record listeners.
 */
describe('createModifierTracker', () => {
  // A minimal fake Window that records listeners and can dispatch to them.
  function fakeWindow() {
    const listeners = new Map<string, Set<EventListener>>();
    return {
      addEventListener: (type: string, fn: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: EventListener) => {
        listeners.get(type)?.delete(fn);
      },
      fire: (type: string, event: unknown) => {
        for (const fn of listeners.get(type) ?? []) fn(event as Event);
      },
      count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    };
  }

  let host: ReturnType<typeof fakeWindow>;
  let engine: ReturnType<typeof fakeWindow>;
  let tracker: ReturnType<typeof createModifierTracker>;

  beforeEach(() => {
    host = fakeWindow();
    engine = fakeWindow();
    tracker = createModifierTracker({
      hostWindow: host as unknown as Window,
      engineWindow: engine as unknown as Window,
    });
  });

  afterEach(() => tracker.disconnect());

  it('should report multi while Shift is held (keydown → keyup)', () => {
    expect(tracker.isMultiSelect()).toBe(false);
    engine.fire('keydown', { shiftKey: true, ctrlKey: false, metaKey: false });
    expect(tracker.isMultiSelect()).toBe(true);
    engine.fire('keyup', { shiftKey: false, ctrlKey: false, metaKey: false });
    expect(tracker.isMultiSelect()).toBe(false);
  });

  it('should count Ctrl and Cmd as multi', () => {
    engine.fire('keydown', { shiftKey: false, ctrlKey: true, metaKey: false });
    expect(tracker.isMultiSelect()).toBe(true);
    engine.fire('keyup', { shiftKey: false, ctrlKey: false, metaKey: false });

    engine.fire('keydown', { shiftKey: false, ctrlKey: false, metaKey: true });
    expect(tracker.isMultiSelect()).toBe(true);
  });

  it('should track key events on the host window too', () => {
    host.fire('keydown', { shiftKey: true, ctrlKey: false, metaKey: false });
    expect(tracker.isMultiSelect()).toBe(true);
  });

  it('should clear on blur (a swallowed keyup must not strand multi=true)', () => {
    engine.fire('keydown', { shiftKey: true, ctrlKey: false, metaKey: false });
    expect(tracker.isMultiSelect()).toBe(true);
    engine.fire('blur', {});
    expect(tracker.isMultiSelect()).toBe(false);
  });

  it('should detach all listeners on disconnect', () => {
    expect(host.count() + engine.count()).toBeGreaterThan(0);
    tracker.disconnect();
    expect(host.count() + engine.count()).toBe(0);
  });
});
