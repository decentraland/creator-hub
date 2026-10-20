/**
 * Mouse-wheel zoom for the Bevy editor fly-camera, captured on the host side.
 *
 * Babylon zooms on the wheel natively (`camera.ts` POINTERWHEEL). The Bevy
 * fly-camera lives in the agent (wasm), which can't read DOM wheel events, so the
 * host listens on the same-origin engine window — where viewport wheel events
 * land — and forwards a step count over the camera bridge, the same `zoom` op
 * the toolbar buttons and the =/- keys use.
 *
 * Only while the editor camera is in free mode: the native avatar camera owns its
 * own scroll-zoom (orbit distance), so in avatar mode the wheel is left to the
 * engine untouched. In free mode the event is consumed (capture phase, before
 * winit's canvas listener) so the hidden avatar camera's orbit distance doesn't
 * drift while the user scrolls the fly-camera.
 */

export interface WheelZoomBridgeOptions {
  /** The engine iframe's content window — where viewport wheel events land. */
  engineWindow: Window;
  /** Called with a signed step count (positive = zoom in) per wheel event. */
  onZoom: (steps: number) => void;
  /** True while the editor fly-camera is engaged (the agent's `zoom` is a no-op in
   * avatar mode, and the avatar camera wants the raw wheel). */
  isFreeCamera: () => boolean;
}

// One mouse-wheel notch is ~100px in pixel mode / ~3 lines in line mode; either
// maps to ONE zoom step, the same dolly as a toolbar button press. Trackpads emit
// many small pixel deltas, which become fractional steps (smooth zoom).
const PIXELS_PER_STEP = 100;
const LINES_PER_STEP = 3;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/** Convert a wheel event's vertical delta into signed zoom steps (up = in). */
export function wheelDeltaToSteps(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  if (!Number.isFinite(e.deltaY) || e.deltaY === 0) return 0;
  const notches =
    e.deltaMode === DOM_DELTA_PAGE
      ? Math.sign(e.deltaY)
      : e.deltaMode === DOM_DELTA_LINE
        ? e.deltaY / LINES_PER_STEP
        : e.deltaY / PIXELS_PER_STEP;
  // Wheel-down (positive deltaY) scrolls "away" = zoom out.
  return -notches;
}

/** Wire wheel capture on the engine window. Returns a disconnect fn. */
export function createWheelZoomBridge(options: WheelZoomBridgeOptions): () => void {
  const { engineWindow, onZoom, isFreeCamera } = options;

  const onWheel = (e: WheelEvent) => {
    if (!isFreeCamera()) return;
    const steps = wheelDeltaToSteps(e);
    // Consume even a zero-delta (horizontal-only) wheel: the hidden avatar camera
    // must not see any wheel input while the fly-camera is engaged.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (steps === 0) return;
    onZoom(steps);
  };

  // `wheel` listeners on a window default to PASSIVE in Chromium, which makes
  // preventDefault a no-op (with a console warning) — opt out explicitly.
  const listenerOptions = { capture: true, passive: false };
  engineWindow.addEventListener('wheel', onWheel as EventListener, listenerOptions);

  return () => {
    engineWindow.removeEventListener('wheel', onWheel as EventListener, listenerOptions);
  };
}
