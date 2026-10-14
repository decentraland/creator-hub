// W, A, S, D, Q, E: the fly-camera keys of both renderers
const CAMERA_KEY_CODES = new Set([87, 65, 83, 68, 81, 69]);

export function isCameraKey(event: KeyboardEvent) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && CAMERA_KEY_CODES.has(event.keyCode);
}

/**
 * The element that receives the viewport's keyboard input: the Babylon canvas, or the canvas
 * inside the Bevy engine iframe that the renderer mounts in the same container.
 */
function getViewport(): { element: HTMLElement; target: EventTarget; win: Window } | null {
  const canvas = document.getElementById('canvas');
  if (!canvas) return null;
  const iframe = canvas.parentElement?.querySelector('iframe');
  const engineWindow = iframe?.contentWindow;
  if (iframe && engineWindow) {
    try {
      const engineCanvas = engineWindow.document.querySelector('canvas');
      return { element: iframe, target: engineCanvas ?? engineWindow, win: engineWindow };
    } catch {
      return null;
    }
  }
  return { element: canvas, target: canvas, win: window };
}

export function isViewportFocused() {
  const viewport = getViewport();
  return !!viewport && document.activeElement === viewport.element;
}

/**
 * Replays a camera key on the viewport, which stops receiving keys once a panel takes the focus.
 * Babylon matches camera keys by the numeric `keyCode`, so the event must carry it.
 */
export function forwardToViewport(type: 'keydown' | 'keyup', keyCode: number): boolean {
  const viewport = getViewport();
  if (!viewport) return false;
  const letter = String.fromCharCode(keyCode);
  const KeyboardEventCtor = (viewport.win as typeof window).KeyboardEvent ?? KeyboardEvent;
  viewport.target.dispatchEvent(
    new KeyboardEventCtor(type, {
      key: letter.toLowerCase(),
      code: `Key${letter.toUpperCase()}`,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    } as KeyboardEventInit),
  );
  return true;
}
