import { createInputFocusBridge } from './input-focus-bridge';

/**
 * The input-focus bridge forwards the inspector's editor shortcut keys from the
 * (same-origin) engine iframe up to the host window, leaves movement keys
 * engine-only, and refocuses the iframe on viewport pointer-down. Driven with
 * fake window/iframe objects that record listeners + dispatches.
 */
describe('createInputFocusBridge', () => {
  type Listener = (e: any) => void;

  function fakeWindow(withDocument = false) {
    const listeners = new Map<string, Set<Listener>>();
    return {
      dispatched: [] as any[],
      // The host window carries a `document` — the bridge dispatches forwarded
      // keys there (that's where the inspector's hotkeys listen). Its own dispatch
      // recorder lets tests assert the event landed on `document`, not `window`.
      document: withDocument
        ? {
            dispatched: [] as any[],
            dispatchEvent(e: any) {
              (this as any).dispatched.push(e);
              return true;
            },
          }
        : undefined,
      addEventListener: (type: string, fn: Listener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: Listener) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent(e: any) {
        (this as any).dispatched.push(e);
        return true;
      },
      // test helper: simulate an event arriving on this window
      emit(type: string, e: any) {
        for (const fn of listeners.get(type) ?? []) fn(e);
      },
      count(type: string) {
        return listeners.get(type)?.size ?? 0;
      },
    };
  }

  const keyEvent = (key: string, extra: Partial<KeyboardEvent> = {}) => {
    let defaultPrevented = false;
    return {
      type: 'keydown',
      key,
      code: key,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      preventDefault: () => {
        defaultPrevented = true;
      },
      get defaultPrevented() {
        return defaultPrevented;
      },
      ...extra,
    };
  };

  let engineWindow: ReturnType<typeof fakeWindow>;
  let hostWindow: ReturnType<typeof fakeWindow>;
  let iframe: { focused: number; focus: () => void };
  let disconnect: () => void;

  beforeEach(() => {
    engineWindow = fakeWindow();
    hostWindow = fakeWindow(true);
    iframe = {
      focused: 0,
      focus() {
        this.focused++;
      },
    };
    disconnect = createInputFocusBridge({
      engineWindow: engineWindow as unknown as Window,
      hostWindow: hostWindow as unknown as Window,
      iframe: iframe as unknown as HTMLIFrameElement,
    });
  });

  afterEach(() => disconnect());

  it('should re-dispatch a bare editor shortcut key onto the host document (bubbling)', () => {
    engineWindow.emit('keydown', keyEvent('f')); // focus-selected
    // Lands on the host DOCUMENT (where hotkeys-js listens), not `window`.
    expect(hostWindow.document!.dispatched).toHaveLength(1);
    expect(hostWindow.dispatched).toHaveLength(0);
    expect(hostWindow.document!.dispatched[0].key).toBe('f');
    expect(hostWindow.document!.dispatched[0].bubbles).toBe(true);
  });

  it('should NOT forward bare movement keys (they stay engine-only)', () => {
    for (const k of ['w', 'a', 's', 'd', ' ']) engineWindow.emit('keydown', keyEvent(k));
    expect(hostWindow.document!.dispatched).toHaveLength(0);
  });

  it('should forward modifier combos (e.g. Ctrl+Z undo) and preventDefault the browser default', () => {
    const e = keyEvent('z', { ctrlKey: true }); // Ctrl+Z (undo)
    engineWindow.emit('keydown', e);
    expect(e.defaultPrevented).toBe(true);
    expect(hostWindow.document!.dispatched).toHaveLength(1);
    expect(hostWindow.document!.dispatched[0].key).toBe('z');
    expect(hostWindow.document!.dispatched[0].ctrlKey).toBe(true);
  });

  it('should NOT preventDefault a bare shortcut key (movement must stay uncancelled)', () => {
    const e = keyEvent('f');
    engineWindow.emit('keydown', e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('should refocus the iframe on viewport pointer-down', () => {
    engineWindow.emit('pointerdown', {});
    expect(iframe.focused).toBe(1);
  });

  it('should detach all listeners on disconnect', () => {
    disconnect();
    expect(engineWindow.count('keydown')).toBe(0);
    expect(engineWindow.count('keyup')).toBe(0);
    expect(engineWindow.count('pointerdown')).toBe(0);
  });
});
