/**
 * Whether numeric transform entry is currently armed, published as a module-level
 * flag (the same shape as `viewport-rect`'s element handle).
 *
 * The only outside reader is the Bevy input bridge: under that renderer key events
 * land in the engine iframe, and the bridge decides there — outside React — which
 * ones to forward to the host. It must forward the modal's grammar keys (axis
 * letters, digits, Enter) ONLY while the modal is armed, or a bare `2` would stop
 * reaching a running scene. A flag avoids threading React state into a bridge
 * built before the component mounts.
 */

let armed = false;

export function setTransformInputArmed(value: boolean): void {
  armed = value;
}

export function isTransformInputArmed(): boolean {
  return armed;
}
