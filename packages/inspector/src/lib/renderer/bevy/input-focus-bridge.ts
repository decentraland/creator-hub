/**
 * Input-focus bridge between the inspector (host document) and the Bevy engine
 * iframe. The engine runs in a SAME-ORIGIN iframe, so when the viewport has focus
 * its key events go to the ENGINE window, not ours — and the inspector's shortcut
 * listeners never see them. Conversely, when the inspector UI (toolbar, tree) has
 * focus, the engine iframe doesn't get keys, so the fly-camera's WASD stops until
 * you click back into the viewport.
 *
 * Because the iframe is same-origin we don't need the engine page to cooperate
 * (it's the external bevy build): the host attaches listeners directly to the
 * engine window.
 *
 *  1. Editor shortcuts (Ctrl/Cmd combos + a few named keys) are RE-DISPATCHED
 *     onto the host window, so undo/save/focus/etc. fire whether the viewport or
 *     a panel holds focus. Bare movement keys (WASD/Space) are NOT forwarded —
 *     they stay engine-only so the fly camera keeps driving.
 *  2. A pointer-down anywhere in the viewport re-focuses the iframe, so returning
 *     to the viewport after using a panel resumes keyboard movement without a
 *     deliberate focus click.
 *
 * Modelled on bevy-editor's `embed.ts` forwardEngineKeys (same engine + iframe
 * setup).
 */

// BARE (unmodified) keys the inspector treats as editor shortcuts. Deliberately
// excludes every fly-camera movement key — w/a/s/d/space — so those stay
// engine-only and can't double-fire or be hijacked. Modifier combos (undo/redo/
// copy/paste/save/duplicate = Ctrl/Cmd+letter) are forwarded separately in
// isForwardedKey, so letters like `d` (Cmd+D duplicate) still work WITH a
// modifier while bare `d` (move right) does not forward. Named keys matched
// exactly; letters case-insensitively.
const BARE_SHORTCUT_KEYS = new Set([
  'f', // focus selected
  '`', // toggle free camera
  'Delete',
  'Backspace',
]);

function isForwardedKey(e: KeyboardEvent): boolean {
  // Modifier combos are always editor shortcuts (undo/redo/copy/paste/save/dup).
  if (e.metaKey || e.ctrlKey) return true;
  return BARE_SHORTCUT_KEYS.has(e.key) || BARE_SHORTCUT_KEYS.has(e.key.toLowerCase());
}

export interface InputFocusBridgeOptions {
  engineWindow: Window;
  /** The host window to re-dispatch onto. Defaults to the real `window`. */
  hostWindow?: Window;
  /** The engine iframe element, refocused on viewport pointer-down. */
  iframe?: HTMLIFrameElement;
}

/**
 * Wire the engine iframe's input to the host. Returns a disconnect fn.
 */
export function createInputFocusBridge(options: InputFocusBridgeOptions): () => void {
  const { engineWindow } = options;
  const hostWindow = options.hostWindow ?? window;
  const iframe = options.iframe;

  const onKey = (e: KeyboardEvent) => {
    if (!isForwardedKey(e)) return;
    // The re-dispatched host event can't cancel the real engine event, so cancel
    // the BROWSER default here for modifier combos (e.g. Cmd+D = bookmark).
    if (e.metaKey || e.ctrlKey) e.preventDefault();
    // Re-dispatch on the host so the inspector's shortcut listeners fire as if it
    // had focus. The engine still receives the original event (not cancelled).
    //
    // Two things the forwarded event MUST carry, or nothing fires (#1370):
    //  - keyCode/which: hotkeys-js matches shortcuts by NUMERIC keyCode, not
    //    `key`. A KeyboardEvent built without keyCode reports keyCode 0, so
    //    hotkeys-js matches nothing — this is why forwarded shortcuts were dead.
    //  - the right dispatch target: hotkeys-js attaches a listener PER bound
    //    element and only fires handlers bound to the element that received the
    //    event. The Toolbar binds undo/redo/save on `document`; the Renderer binds
    //    copy/paste/delete/duplicate/focus/zoom on `document.body`. Dispatching on
    //    `body` fires the body listener AND bubbles to the document listener (each
    //    filters to its own handlers — no double-fire), so BOTH sets work. A
    //    dispatch on `document` alone would miss the body-bound ones.
    const doc = hostWindow.document;
    const target = (doc && (doc.body ?? doc)) ?? hostWindow;
    target.dispatchEvent(
      new KeyboardEvent(e.type, {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        which: e.which,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        bubbles: true,
        cancelable: true,
      } as KeyboardEventInit),
    );
  };

  // Returning to the viewport resumes movement without a deliberate focus click.
  const onPointerDown = () => iframe?.focus();

  for (const type of ['keydown', 'keyup'] as const) {
    engineWindow.addEventListener(type, onKey as EventListener, { capture: true });
  }
  engineWindow.addEventListener('pointerdown', onPointerDown, { capture: true });

  return () => {
    for (const type of ['keydown', 'keyup'] as const) {
      engineWindow.removeEventListener(type, onKey as EventListener, { capture: true } as never);
    }
    engineWindow.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
  };
}
