import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { AgentToPage, BusEnvelope } from '@dcl/inspector-bevy-protocol';

/**
 * Hover-hint bridge (#1476). The editor doesn't mount the engine's own hover-hint
 * HUD, so an interactable smart item gives no "Press E" cue while the tester points
 * at it with Interact toggled on. The Bevy agent raycasts the entity under the
 * pointer (while editing is OFF) and posts `{ kind: 'hover', entity }`; this bridge
 * turns that into a small DOM prompt over the viewport, reading the entity's
 * hoverText + input key from `resolve` (the host's own ECS — the agent's separate
 * engine can't read the scene's component values). `entity` 0 clears it.
 *
 * Its own BroadcastChannel instance, so it coexists with the pick / scene-run
 * bridges (each `new BroadcastChannel(name)` receives messages independently).
 */
export interface HoverHint {
  /** Input key label to show in the badge, e.g. "E". */
  key: string;
  /** The item's hover text, e.g. "Press". Author-controlled — rendered as text. */
  text: string;
}

export interface HoverHintBridgeOptions {
  /** Viewport container the engine iframe lives in; the prompt overlays it. */
  container: HTMLElement;
  /** Look up the hint for a hovered entity (0 or non-interactable → null). */
  resolve: (entity: number) => HoverHint | null;
  /** Test seam: the channel to listen on. Defaults to a real BroadcastChannel. */
  channel?: { onmessage: ((ev: { data: unknown }) => void) | null; close(): void };
}

function toHoverMsg(data: unknown): Extract<AgentToPage, { kind: 'hover' }> | null {
  if (!data || typeof data !== 'object') return null;
  const env = data as Partial<BusEnvelope>;
  if (env.to !== 'page' || !env.msg || typeof env.msg !== 'object') return null;
  const msg = env.msg as { kind?: unknown; entity?: unknown };
  if (msg.kind === 'hover' && typeof msg.entity === 'number') {
    return env.msg as Extract<AgentToPage, { kind: 'hover' }>;
  }
  return null;
}

/** Layout `display` each element uses while shown — see `setShown`. */
const HINT_DISPLAY = 'flex';
const BADGE_DISPLAY = 'inline-flex';

/**
 * Show/hide an element that carries an INLINE `display`. The `hidden` property
 * alone does NOT hide these: it works through the UA stylesheet rule
 * `[hidden]{display:none}`, and a style-attribute declaration outranks any
 * stylesheet rule — so the prompt sat permanently visible (and empty, its white
 * key badge reading as a stray checkbox) over every Bevy viewport. Keep `hidden`
 * in sync for semantics, but drive `display` for the actual effect.
 */
function setShown(el: HTMLElement, shown: boolean, display: string): void {
  el.hidden = !shown;
  el.style.display = shown ? display : 'none';
}

export function createHoverHintBridge(options: HoverHintBridgeOptions): () => void {
  const { container, resolve } = options;
  const channel =
    options.channel ??
    (new BroadcastChannel(EDITOR_BUS_CHANNEL) as unknown as NonNullable<
      HoverHintBridgeOptions['channel']
    >);

  const hint = document.createElement('div');
  hint.className = 'BevyHoverHint';
  // Overlays the (dark) 3D viewport, so fixed dark-on-light styling reads in either
  // app theme. pointer-events:none keeps it from stealing the hover it describes.
  hint.style.cssText = [
    'position:absolute',
    'left:50%',
    'bottom:14%',
    'transform:translateX(-50%)',
    'align-items:center',
    'gap:8px',
    'padding:7px 12px',
    'border-radius:8px',
    'background:rgba(20,20,22,0.82)',
    'color:#fff',
    'font-size:13px',
    'font-weight:500',
    'line-height:1',
    'white-space:nowrap',
    'pointer-events:none',
    'z-index:5',
    'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
  ].join(';');
  const badge = document.createElement('span');
  badge.className = 'BevyHoverHint-key';
  badge.style.cssText = [
    'align-items:center',
    'justify-content:center',
    'min-width:20px',
    'height:20px',
    'padding:0 5px',
    'border-radius:4px',
    'background:#fff',
    'color:#141416',
    'font-weight:700',
    'font-size:12px',
  ].join(';');
  const label = document.createElement('span');
  hint.append(badge, label);
  setShown(hint, false, HINT_DISPLAY);
  // The prompt is absolutely positioned; anchor it to the container (the engine
  // iframe fills it) unless the container is already a positioned ancestor.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(hint);

  const show = (h: HoverHint) => {
    badge.textContent = h.key;
    setShown(badge, h.key.length > 0, BADGE_DISPLAY);
    label.textContent = h.text;
    setShown(hint, true, HINT_DISPLAY);
  };
  const hide = () => {
    setShown(hint, false, HINT_DISPLAY);
  };

  channel.onmessage = ({ data }: { data: unknown }) => {
    const msg = toHoverMsg(data);
    if (msg === null) return;
    if (msg.entity === 0) {
      hide();
      return;
    }
    const h = resolve(msg.entity);
    if (h === null) hide();
    else show(h);
  };

  return () => {
    channel.onmessage = null;
    channel.close();
    hint.remove();
  };
}
