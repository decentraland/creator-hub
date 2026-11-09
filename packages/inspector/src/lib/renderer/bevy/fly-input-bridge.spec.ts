import type { FlyInput } from '@dcl/inspector-bevy-protocol';
import { createFlyInputBridge } from './fly-input-bridge';

/**
 * The fly-input bridge owns the fly camera's movement keys on the host: while the
 * editor camera is free it swallows WASD/Space on the (same-origin) engine window
 * so the avatar can't walk, and forwards the held state to the agent; E/Q are
 * captured whenever editing is on. Driven with a fake window that records
 * listeners.
 */
describe('createFlyInputBridge', () => {
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
      count() {
        return [...listeners.values()].reduce((n, s) => n + s.size, 0);
      },
    };
  }

  const keyEvent = (code: string, mods: Partial<KeyboardEvent> = {}) => {
    const e = {
      code,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      ...mods,
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

  const RELEASED: FlyInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  };

  function setup(opts: { free?: () => boolean; editing?: () => boolean } = {}) {
    const win = fakeWindow();
    const onChange = vi.fn<(input: FlyInput) => void>();
    const disconnect = createFlyInputBridge({
      engineWindow: win as unknown as Window,
      onChange,
      isFreeCamera: opts.free ?? (() => true),
      isEditingEnabled: opts.editing,
    });
    return { win, onChange, disconnect };
  }

  describe('with the free camera active', () => {
    it('swallows WASD and Space and reports them held', () => {
      const { win, onChange } = setup();
      const w = keyEvent('KeyW');
      win.emit('keydown', w);
      expect(w.defaultPrevented).toBe(true);
      expect(w.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, forward: true });

      win.emit('keydown', keyEvent('Space'));
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, forward: true, up: true });

      const release = keyEvent('KeyW', { shiftKey: true });
      win.emit('keyup', release);
      expect(release.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, up: true });
    });

    it('matches the physical key, so AZERTY Z (W position) is captured and W is not', () => {
      const { win, onChange } = setup();
      const z = keyEvent('KeyW', { key: 'z' });
      win.emit('keydown', z);
      expect(z.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, forward: true });

      const w = keyEvent('KeyZ', { key: 'w' });
      win.emit('keydown', w);
      expect(w.propagationStopped).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does not re-fire on key auto-repeat', () => {
      const { win, onChange } = setup();
      win.emit('keydown', keyEvent('KeyA'));
      win.emit('keydown', keyEvent('KeyA'));
      win.emit('keydown', keyEvent('KeyA'));
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('keeps rising while Space is held after E is released (both mean up)', () => {
      const { win, onChange } = setup();
      win.emit('keydown', keyEvent('KeyE'));
      win.emit('keydown', keyEvent('Space'));
      win.emit('keyup', keyEvent('KeyE'));
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, up: true });
      win.emit('keyup', keyEvent('Space'));
      expect(onChange).toHaveBeenLastCalledWith(RELEASED);
    });

    it('leaves modifier combos alone (editor shortcuts such as Cmd+S / Cmd+D)', () => {
      const { win, onChange } = setup();
      const save = keyEvent('KeyS', { metaKey: true });
      win.emit('keydown', save);
      const dup = keyEvent('KeyD', { ctrlKey: true });
      win.emit('keydown', dup);
      expect(save.propagationStopped).toBe(false);
      expect(dup.propagationStopped).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores keys it does not own', () => {
      const { win, onChange } = setup();
      const f = keyEvent('KeyF');
      win.emit('keydown', f);
      expect(f.propagationStopped).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('releases everything on blur so the camera cannot drift', () => {
      const { win, onChange } = setup();
      win.emit('keydown', keyEvent('KeyW'));
      win.emit('keydown', keyEvent('KeyD'));
      win.emit('blur', {});
      expect(onChange).toHaveBeenLastCalledWith(RELEASED);
      win.emit('blur', {});
      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('with the player (avatar) camera active', () => {
    it('lets WASD and Space reach the engine so the avatar walks', () => {
      const { win, onChange } = setup({ free: () => false });
      const w = keyEvent('KeyW');
      win.emit('keydown', w);
      const space = keyEvent('Space');
      win.emit('keydown', space);
      expect(w.propagationStopped).toBe(false);
      expect(space.propagationStopped).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('still captures E/Q (Q has no InputAction; E would fire IA_PRIMARY)', () => {
      const { win, onChange } = setup({ free: () => false });
      const q = keyEvent('KeyQ');
      win.emit('keydown', q);
      expect(q.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, down: true });
    });

    it('releases a key held from before the camera switched (Free → Player)', () => {
      let free = true;
      const { win, onChange } = setup({ free: () => free });
      win.emit('keydown', keyEvent('KeyW'));
      free = false;
      const release = keyEvent('KeyW');
      win.emit('keyup', release);
      // The engine never saw this key go down, so it must not see it come up.
      expect(release.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith(RELEASED);
    });

    it('lets the keyup reach the engine when the keydown did (Player → Free mid-hold)', () => {
      let free = false;
      const { win, onChange } = setup({ free: () => free });
      const press = keyEvent('KeyW');
      win.emit('keydown', press);
      expect(press.propagationStopped).toBe(false);
      free = true;
      const release = keyEvent('KeyW');
      win.emit('keyup', release);
      // Swallowing it would leave IA_FORWARD pressed in the engine for good.
      expect(release.propagationStopped).toBe(false);
      expect(release.defaultPrevented).toBe(false);
      expect(onChange).not.toHaveBeenCalled();

      const again = keyEvent('KeyW');
      win.emit('keydown', again);
      expect(again.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, forward: true });
    });
  });

  describe('with editing off (Interact mode, #1458)', () => {
    it('lets E/Q reach the running scene but still owns WASD for the free camera', () => {
      const { win, onChange } = setup({ editing: () => false });
      const e = keyEvent('KeyE');
      win.emit('keydown', e);
      expect(e.propagationStopped).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
      const w = keyEvent('KeyW');
      win.emit('keydown', w);
      expect(w.propagationStopped).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({ ...RELEASED, forward: true });
    });
  });

  it('removes its listeners on disconnect', () => {
    const { win, disconnect } = setup();
    expect(win.count()).toBe(3);
    disconnect();
    expect(win.count()).toBe(0);
  });
});
