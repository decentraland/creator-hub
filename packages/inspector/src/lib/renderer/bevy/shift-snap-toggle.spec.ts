import { createShiftSnapToggle } from './shift-snap-toggle';

/**
 * Holding Shift inverts the editor's snap setting for as long as it's held, and
 * release restores what the Snap panel had — flipping the shared manager itself,
 * since the reverse channel re-snaps every gizmo commit through it.
 */
describe('createShiftSnapToggle', () => {
  function setup(initialEnabled: boolean) {
    let shift = false;
    const listeners = new Set<() => void>();
    let enabled = initialEnabled;
    const setEnabled = vi.fn((value: boolean) => {
      enabled = value;
    });
    const disconnect = createShiftSnapToggle({
      isShift: () => shift,
      onShiftChange: cb => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      snap: { isEnabled: () => enabled, setEnabled },
    });
    const press = () => {
      shift = true;
      for (const cb of listeners) cb();
    };
    const release = () => {
      shift = false;
      for (const cb of listeners) cb();
    };
    return { isEnabled: () => enabled, setEnabled, press, release, disconnect, listeners };
  }

  it('turns snapping off while Shift is held when the panel has it on, then restores it', () => {
    const t = setup(true);
    t.press();
    expect(t.isEnabled()).toBe(false);
    t.release();
    expect(t.isEnabled()).toBe(true);
  });

  it('turns snapping on while Shift is held when the panel has it off, then restores it', () => {
    const t = setup(false);
    t.press();
    expect(t.isEnabled()).toBe(true);
    t.release();
    expect(t.isEnabled()).toBe(false);
  });

  it('does not re-invert on a repeated press notification', () => {
    const t = setup(true);
    t.press();
    t.press();
    expect(t.isEnabled()).toBe(false);
    expect(t.setEnabled).toHaveBeenCalledTimes(1);
  });

  it('ignores a release with no press (a blur clearing an untracked Shift)', () => {
    const t = setup(true);
    t.release();
    expect(t.setEnabled).not.toHaveBeenCalled();
  });

  it('restores the panel state and unsubscribes on disconnect while Shift is held', () => {
    const t = setup(true);
    t.press();
    t.disconnect();
    expect(t.isEnabled()).toBe(true);
    expect(t.listeners.size).toBe(0);
  });
});
