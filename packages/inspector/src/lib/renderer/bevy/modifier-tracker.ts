/**
 * Tracks the live keyboard-modifier state (Shift / Ctrl / Cmd) for the Bevy
 * viewport, so a viewport pick can be a multi-select.
 *
 * The pick itself is reported by the editor-agent scene, which runs in the
 * engine's wasm sandbox and can't read raw DOM modifier keys. But the engine
 * iframe is SAME-ORIGIN, so the host CAN observe its key events directly (the
 * input-focus bridge already does). This listens on both the host window and the
 * engine window and remembers whether a multi-select modifier is currently held;
 * the pick bridge consults it when a pick arrives, instead of trusting the
 * agent's (always-single) flags.
 *
 * Shift and Ctrl/Cmd both count as multi-select, matching the hierarchy tree's
 * multi-select modifiers (and the reverse channel's `multi` = shift || ctrl).
 */

export interface ModifierTracker {
  /** True while a multi-select modifier (Shift / Ctrl / Cmd) is held down. */
  isMultiSelect(): boolean;
  /** True while Shift specifically is held down. Used to toggle snap during a
   * gizmo drag (Shift inverts the Snap panel: snap on → smooth, off → snapped),
   * matching Babylon's `initKeyboard` shift-held-toggles-snap behaviour. */
  isShift(): boolean;
  /** Subscribe to Shift press/release transitions. The snap the selection bridge
   * sends to the agent depends on `isShift()`, so a Shift toggle must re-post the
   * selection — this fires exactly when `isShift()` flips. Returns an unsubscribe. */
  onShiftChange(cb: () => void): () => void;
  disconnect(): void;
}

export interface ModifierTrackerOptions {
  /** The engine iframe's content window (same-origin — we read its key events). */
  engineWindow: Window;
  /** The host window. Defaults to the real `window`. */
  hostWindow?: Window;
}

export function createModifierTracker(options: ModifierTrackerOptions): ModifierTracker {
  const { engineWindow } = options;
  const hostWindow = options.hostWindow ?? window;

  let multi = false;
  let shift = false;
  const shiftListeners = new Set<() => void>();

  const setShift = (next: boolean) => {
    if (next === shift) return;
    shift = next;
    for (const cb of shiftListeners) cb();
  };

  const sync = (e: KeyboardEvent) => {
    multi = e.shiftKey || e.ctrlKey || e.metaKey;
    setShift(e.shiftKey);
  };
  // A blur (tab/window switch) can eat the keyup, stranding `multi`/`shift` true —
  // clear both whenever focus leaves so a later plain click isn't a phantom
  // multi-select and a later drag isn't a phantom snap-toggle.
  const clear = () => {
    multi = false;
    setShift(false);
  };

  const windows = new Set<Window>([hostWindow, engineWindow]);
  for (const w of windows) {
    for (const type of ['keydown', 'keyup'] as const) {
      w.addEventListener(type, sync as EventListener, { capture: true });
    }
    w.addEventListener('blur', clear, { capture: true });
  }

  return {
    isMultiSelect: () => multi,
    isShift: () => shift,
    onShiftChange: cb => {
      shiftListeners.add(cb);
      return () => shiftListeners.delete(cb);
    },
    disconnect: () => {
      shiftListeners.clear();
      for (const w of windows) {
        for (const type of ['keydown', 'keyup'] as const) {
          w.removeEventListener(type, sync as EventListener, { capture: true } as never);
        }
        w.removeEventListener('blur', clear, { capture: true } as never);
      }
    },
  };
}
