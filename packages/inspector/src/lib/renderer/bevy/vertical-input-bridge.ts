/**
 * E/Q vertical fly-camera input, captured on the host side.
 *
 * The Bevy fly camera reads WASD + Space + Shift inside the engine as
 * Decentraland `InputAction`s. Vertical up/down "should" work the same way, but
 * there is no `InputAction` bound to the Q key — so the engine can never deliver
 * it. E maps to `IA_PRIMARY`, but to keep E and Q symmetric (and E free of the
 * engine's own primary-action semantics) we capture BOTH here.
 *
 * The engine runs in a same-origin iframe, so while the viewport holds focus its
 * key events go to the ENGINE window. We attach here (same window the
 * input-focus bridge uses), track the held state of E/Q, and push it to the agent
 * over the bus (via the camera bridge). keydown auto-repeats while a key is held,
 * so we only fire the callback when the combined held state actually changes.
 *
 * E and Q ALSO map to engine InputActions the editor doesn't want: Q =
 * SystemAction::PointAt (the avatar's point-at gesture) and E = IA_PRIMARY (the
 * scene's primary action). Both fire whenever the key reaches the engine — so
 * while the avatar visibly reacts to Q as "point at", and E can trip scene logic,
 * neither adds value in the editor. We consume the event here (capture phase,
 * `stopImmediatePropagation` + `preventDefault`) so the engine's own key handler
 * (winit, later in the dispatch on this same window) never sees E/Q. The vertical
 * fly still works because we forward the held state over the bus, not through the
 * engine's InputAction path.
 */

export interface VerticalInputBridgeOptions {
  /** The engine iframe's content window — where viewport key events land. */
  engineWindow: Window;
  /** Called with the current held state whenever it changes (up = E, down = Q). */
  onChange: (up: boolean, down: boolean) => void;
}

const UP_KEY = 'e';
const DOWN_KEY = 'q';

/** Wire E/Q capture on the engine window. Returns a disconnect fn. */
export function createVerticalInputBridge(options: VerticalInputBridgeOptions): () => void {
  const { engineWindow, onChange } = options;
  let up = false;
  let down = false;

  /** True while this key is one of ours (E/Q) — i.e. we own it and the engine
   * must not also process it. Used to decide whether to swallow the event. */
  const isVerticalKey = (key: string): boolean => {
    const k = key.toLowerCase();
    return k === UP_KEY || k === DOWN_KEY;
  };

  const apply = (key: string, pressed: boolean): void => {
    const k = key.toLowerCase();
    const next = { up, down };
    if (k === UP_KEY) next.up = pressed;
    else if (k === DOWN_KEY) next.down = pressed;
    else return;
    if (next.up === up && next.down === down) return; // key-repeat / unchanged
    up = next.up;
    down = next.down;
    onChange(up, down);
  };

  // Swallow E/Q so the engine's own key handler (later in the dispatch on this
  // window) never sees them — otherwise Q also fires the avatar's PointAt gesture
  // and E fires IA_PRIMARY. We still drive the vertical fly via the forwarded
  // held state, so consuming the raw event costs nothing.
  const swallow = (e: KeyboardEvent): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Bare key only — a modifier combo (e.g. Cmd+E) is an editor shortcut, not fly.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isVerticalKey(e.key)) swallow(e);
    apply(e.key, true);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey && isVerticalKey(e.key)) swallow(e);
    apply(e.key, false);
  };
  // Losing focus can swallow the keyup (the engine iframe blurs mid-hold), which
  // would leave the camera drifting forever — clear the held state on blur.
  const onBlur = () => {
    if (!up && !down) return;
    up = false;
    down = false;
    onChange(false, false);
  };

  engineWindow.addEventListener('keydown', onKeyDown as EventListener, { capture: true });
  engineWindow.addEventListener('keyup', onKeyUp as EventListener, { capture: true });
  engineWindow.addEventListener('blur', onBlur);

  return () => {
    engineWindow.removeEventListener(
      'keydown',
      onKeyDown as EventListener,
      {
        capture: true,
      } as never,
    );
    engineWindow.removeEventListener('keyup', onKeyUp as EventListener, { capture: true } as never);
    engineWindow.removeEventListener('blur', onBlur);
  };
}
