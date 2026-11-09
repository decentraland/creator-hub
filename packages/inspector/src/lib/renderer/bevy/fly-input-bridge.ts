import type { FlyInput } from '@dcl/inspector-bevy-protocol';

/**
 * Fly-camera movement keys, captured on the host side.
 *
 * The engine runs in a same-origin iframe, so while the viewport holds focus its
 * key events go to the ENGINE window. The engine turns WASD / Space into player
 * InputActions, which the basic-controller portable reads to WALK THE AVATAR —
 * and it keeps doing so while the editor's fly camera is active, because the
 * agent's `InputModifier` is only one candidate among the scenes containing the
 * player and nothing guarantees it wins. So while the editor camera is FREE this
 * bridge owns the movement keys outright: it swallows them on the engine window
 * in the capture phase (`stopImmediatePropagation` + `preventDefault`, before the
 * engine's own winit handler on the same window) and forwards their held state
 * to the agent over the bus, which flies the camera from that instead. The avatar
 * never sees the keys. In the player camera the keys flow to the engine untouched.
 *
 * E and Q are captured whenever editing is on, regardless of the camera mode: Q
 * has no SDK InputAction (the engine could never deliver it) and both map to
 * engine actions the editor doesn't want — Q = the avatar's point-at gesture, E =
 * IA_PRIMARY. With editing OFF (the "Interact" toggle, #1458) they reach the engine
 * so the running scene can react to them.
 *
 * keydown auto-repeats while a key is held, so the callback only fires when the
 * combined held state actually changes.
 */

export interface FlyInputBridgeOptions {
  /** The engine iframe's content window — where viewport key events land. */
  engineWindow: Window;
  /** Called with the full held state whenever any key changes. */
  onChange: (input: FlyInput) => void;
  /** True while the editor camera is the free fly-camera. Movement keys (WASD /
   * Space) are captured only then; in the player camera they walk the avatar. */
  isFreeCamera: () => boolean;
  /** True while editing is on (the default). Gates E/Q only (see above). */
  isEditingEnabled?: () => boolean;
}

const MOVEMENT_KEYS: Record<string, keyof FlyInput> = {
  w: 'forward',
  s: 'backward',
  a: 'left',
  d: 'right',
  ' ': 'up',
};

const VERTICAL_KEYS: Record<string, keyof FlyInput> = {
  e: 'up',
  q: 'down',
};

const RELEASED: FlyInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

/** Wire movement-key capture on the engine window. Returns a disconnect fn. */
export function createFlyInputBridge(options: FlyInputBridgeOptions): () => void {
  const { engineWindow, onChange, isFreeCamera } = options;
  const isEditingEnabled = options.isEditingEnabled ?? (() => true);
  // E and Space both mean "up", so each key is tracked on its own and the flags
  // sent to the agent are derived — releasing E while Space is held keeps rising.
  const held = new Set<string>();

  const derive = (): FlyInput => {
    const input = { ...RELEASED };
    for (const key of held) {
      const flag = MOVEMENT_KEYS[key] ?? VERTICAL_KEYS[key];
      if (flag) input[flag] = true;
    }
    return input;
  };

  let last = derive();
  const publish = () => {
    const next = derive();
    if ((Object.keys(next) as (keyof FlyInput)[]).every(k => next[k] === last[k])) return;
    last = next;
    onChange(next);
  };

  /** Whether this bridge owns the key right now (and the engine must not see it). */
  const owns = (key: string): boolean => {
    if (key in VERTICAL_KEYS) return isEditingEnabled();
    if (key in MOVEMENT_KEYS) return isFreeCamera();
    return false;
  };

  const swallow = (e: KeyboardEvent): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // A modifier combo (Cmd+S, Cmd+D…) is an editor shortcut, never movement.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (!owns(key)) return;
    swallow(e);
    held.add(key);
    publish();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    // Always release a key we're holding, even if ownership changed mid-hold (the
    // camera mode flipped), so no flag is left stuck true.
    const wasHeld = held.delete(key);
    if (!e.metaKey && !e.ctrlKey && !e.altKey && owns(key)) swallow(e);
    if (wasHeld) publish();
  };
  // Losing focus can swallow the keyup (the engine iframe blurs mid-hold), which
  // would leave the camera drifting forever — release everything on blur.
  const onBlur = () => {
    if (held.size === 0) return;
    held.clear();
    publish();
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
