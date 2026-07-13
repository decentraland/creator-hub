import type { Entity } from '@dcl/ecs';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type {
  BusEnvelope,
  GizmoMode,
  PageToScene,
  SelectionEntity,
} from '@dcl/inspector-bevy-protocol';
import { GizmoType } from '../../utils/gizmo';
import type { BevySceneContext } from './BevySceneContext';

/** Map the ECS Selection gizmo enum → the wire's gizmo mode string. */
function toGizmoMode(gizmo: GizmoType | undefined): GizmoMode {
  switch (gizmo) {
    case GizmoType.POSITION:
      return 'translate';
    case GizmoType.ROTATION:
      return 'rotate';
    case GizmoType.SCALE:
      return 'scale';
    default:
      return 'free';
  }
}

/**
 * Forward the inspector's current selection to the editor-agent scene over the
 * BroadcastChannel, so its gizmo attaches to whatever is selected — whether the
 * selection came from a viewport pick or a click in the inspector tree.
 *
 * The `Selection` editor component marks selected entities in the ECS; the same
 * CRDT stream feeds BevySceneContext's engine, so we observe selection changes
 * there and post EVERY selected entity's world pose (`set-selection`, the shared
 * `@dcl/inspector-bevy-protocol` message). The agent anchors the gizmo at their
 * centroid and transforms each about that virtual pivot — so multi-selection
 * works for all gizmo modes.
 */

/** Minimal BroadcastChannel surface (also used by pick-bridge). */
interface Channel {
  postMessage(msg: unknown): void;
  close(): void;
}

export interface SelectionBridgeOptions {
  context: BevySceneContext;
  /** The renderer's gizmo settings — world alignment for the translate/rotate
   * gizmos (the toolbar's "align to world" checkbox). Optional so the bridge can
   * run without a renderer (tests); then `alignToWorld` is always true. */
  gizmos?: { isWorldAligned(): boolean; onChange(cb: () => void): () => void };
  /** The editor's snap settings (the toolbar's Snap panel): the increments when
   * snapping is enabled, or null when it's off. Optional (tests); absent =
   * snapping off. */
  snap?: {
    getSnap(): { position: number; rotation: number; scale: number } | null;
    onChange(cb: () => void): () => void;
  };
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export function createSelectionBridge(options: SelectionBridgeOptions): () => void {
  const { context, gizmos } = options;
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);
  const Selection = context.editorComponents.Selection;

  // Dedupe by the full serialized message: a repost fires for entity, mode,
  // position AND rotation changes (any of them moves/re-orients the gizmo).
  let lastPosted: string | undefined;

  const post = () => {
    // Current selection = every entity carrying the Selection component. The
    // gizmo mode is a per-selection setting (Selection.gizmo), shared across the
    // selection — read it from whichever entity we see first.
    const selected: Entity[] = [];
    let gizmo: GizmoType | undefined;
    for (const [e, selection] of context.engine.getEntitiesWith(Selection)) {
      if (gizmo === undefined) gizmo = selection.gizmo;
      selected.push(e);
    }
    const mode = toGizmoMode(gizmo);
    // Send each entity's world position + rotation: the agent scene can't read
    // the inspected scene's Transform from its own engine, so the inspector
    // (which owns the CRDT) supplies where to place the gizmo (their centroid)
    // and how to orient it (single-selection scale/local-align uses the rotation).
    const worldPositions = context.getEntityWorldPositions(selected);
    const entities: SelectionEntity[] = [];
    for (const e of selected) {
      const wp = worldPositions.get(e) ?? null;
      if (wp === null) continue; // no transform tracked → can't place a handle
      const wr = context.getEntityWorldRotation(e);
      entities.push({
        entity: e as number,
        position: { x: wp.x, y: wp.y, z: wp.z },
        rotation: wr === null ? { x: 0, y: 0, z: 0, w: 1 } : { x: wr.x, y: wr.y, z: wr.z, w: wr.w },
      });
    }
    const alignToWorld = gizmos?.isWorldAligned() ?? true;
    const snap = options.snap?.getSnap() ?? null;
    const msg: PageToScene = {
      kind: 'set-selection',
      entities,
      alignToWorld,
      snap,
      mode,
    };
    const serialized = JSON.stringify(msg);
    if (serialized === lastPosted) return;
    lastPosted = serialized;
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  // Post whenever a Selection component changes (added/removed OR gizmo mode
  // edit), and on Transform changes so the gizmo tracks moves/rotations made
  // while selected (a gizmo commit, a properties-panel edit, undo). Any
  // entity's Transform can matter (a parent move shifts the selection's world
  // pose); the value-dedupe in post() drops the no-op reposts.
  const off = context.onChange((_entity, _op, component) => {
    if (!component) return;
    if (
      component.componentId === Selection.componentId ||
      component.componentId === context.Transform.componentId
    ) {
      post();
    }
  });

  // Re-post when the "align to world" setting toggles (the agent re-orients the
  // gizmo on the current selection) or the snap settings change (the agent
  // re-quantizes its drags).
  const offGizmos = gizmos?.onChange(post);
  const offSnap = options.snap?.onChange(post);

  return () => {
    off();
    offGizmos?.();
    offSnap?.();
    channel.close();
  };
}
