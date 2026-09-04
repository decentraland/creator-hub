import { createWheelZoomBridge, wheelDeltaToSteps } from './wheel-zoom-bridge';

/**
 * The wheel-zoom bridge turns wheel events on the (same-origin) engine window
 * into fly-camera zoom steps while the editor camera is free, and leaves the
 * wheel to the engine's own avatar camera otherwise. Driven with a fake window
 * that records listeners.
 */
describe('createWheelZoomBridge', () => {
  type Listener = (e: any) => void;

  function fakeWindow() {
    const listeners = new Map<string, Set<Listener>>();
    return {
      addEventListener: (type: string, fn: Listener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: Listener) => {
        listeners.get(type)?.delete(fn);
      },
      emit(type: string, e: any) {
        for (const fn of listeners.get(type) ?? []) fn(e);
      },
      count(type: string) {
        return listeners.get(type)?.size ?? 0;
      },
    };
  }

  const wheelEvent = (deltaY: number, deltaMode = 0) => {
    const e = {
      deltaY,
      deltaMode,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() {
        e.defaultPrevented = true;
      },
      stopImmediatePropagation() {
        e.propagationStopped = true;
      },
    };
    return e;
  };

  function setup(isFreeCamera = () => true) {
    const win = fakeWindow();
    const onZoom = vi.fn();
    const disconnect = createWheelZoomBridge({
      engineWindow: win as unknown as Window,
      onZoom,
      isFreeCamera,
    });
    return { win, onZoom, disconnect };
  }

  it('zooms in one step per wheel notch scrolled up, out when scrolled down', () => {
    const { win, onZoom } = setup();
    win.emit('wheel', wheelEvent(-100));
    win.emit('wheel', wheelEvent(100));
    expect(onZoom.mock.calls).toEqual([[1], [-1]]);
  });

  it('consumes the wheel in free mode so the engine avatar camera never sees it', () => {
    const { win } = setup();
    const e = wheelEvent(-100);
    win.emit('wheel', e);
    expect(e.defaultPrevented).toBe(true);
    expect(e.propagationStopped).toBe(true);
  });

  it('turns trackpad pixel deltas into fractional steps', () => {
    const { win, onZoom } = setup();
    win.emit('wheel', wheelEvent(-25));
    expect(onZoom).toHaveBeenCalledWith(0.25);
  });

  it('leaves the wheel to the engine in avatar mode', () => {
    const { win, onZoom } = setup(() => false);
    const e = wheelEvent(-100);
    win.emit('wheel', e);
    expect(onZoom).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
    expect(e.propagationStopped).toBe(false);
  });

  it('consumes a horizontal-only wheel without emitting a zero step', () => {
    const { win, onZoom } = setup();
    const e = wheelEvent(0);
    win.emit('wheel', e);
    expect(onZoom).not.toHaveBeenCalled();
    expect(e.propagationStopped).toBe(true);
  });

  it('removes its listener on disconnect', () => {
    const { win, disconnect } = setup();
    expect(win.count('wheel')).toBe(1);
    disconnect();
    expect(win.count('wheel')).toBe(0);
  });
});

describe('wheelDeltaToSteps', () => {
  it('maps a 100px notch to one step', () => {
    expect(wheelDeltaToSteps({ deltaY: -100, deltaMode: 0 })).toBe(1);
  });

  it('maps three lines to one step in line mode', () => {
    expect(wheelDeltaToSteps({ deltaY: 3, deltaMode: 1 })).toBe(-1);
  });

  it('maps a page scroll to exactly one step regardless of magnitude', () => {
    expect(wheelDeltaToSteps({ deltaY: -7, deltaMode: 2 })).toBe(1);
  });

  it('returns zero for no vertical delta or a non-finite one', () => {
    expect(wheelDeltaToSteps({ deltaY: 0, deltaMode: 0 })).toBe(0);
    expect(wheelDeltaToSteps({ deltaY: NaN, deltaMode: 0 })).toBe(0);
  });
});
