import type { Entity } from '@dcl/ecs';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { BusEnvelope, GizmoMode, PageToScene } from '@dcl/inspector-bevy-protocol';
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
 * there and post the current selected entity (`set-selection`, the shared
 * `@dcl/inspector-bevy-protocol` message). The gizmo is single-entity for now, so we
 * send the first selected entity (or null).
 */

/** Minimal BroadcastChannel surface (also used by pick-bridge). */
interface Channel {
  postMessage(msg: unknown): void;
  close(): void;
}

export interface SelectionBridgeOptions {
  context: BevySceneContext;
  /** The renderer's gizmo settings — world alignment for the translate gizmo
   * (the toolbar's "align to world" checkbox). Optional so the bridge can run
   * without a renderer (tests); then `alignToWorld` is always true. */
  gizmos?: { isWorldAligned(): boolean; onChange(cb: () => void): () => void };
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
    // Current selection = entities carrying the Selection component. Single-entity
    // gizmo → take the first (or null when nothing is selected). The selected
    // entity also carries the active gizmo mode (Selection.gizmo).
    let entity: Entity | null = null;
    let gizmo: GizmoType | undefined;
    for (const [e, selection] of context.engine.getEntitiesWith(Selection)) {
      entity = e;
      gizmo = selection.gizmo;
      break;
    }
    const value = entity === null ? null : (entity as number);
    const mode = toGizmoMode(gizmo);
    // Send the entity's world position + rotation too: the agent scene can't
    // read the inspected scene's Transform from its own engine, so the inspector
    // (which owns the CRDT) supplies where to place the gizmo and how to orient
    // it (the scale gizmo aligns its handles to the entity's rotation).
    const wp =
      entity === null ? null : (context.getEntityWorldPositions([entity]).get(entity) ?? null);
    const position = wp === null ? null : { x: wp.x, y: wp.y, z: wp.z };
    const wr = entity === null ? null : context.getEntityWorldRotation(entity);
    const rotation = wr === null ? null : { x: wr.x, y: wr.y, z: wr.z, w: wr.w };
    const alignToWorld = gizmos?.isWorldAligned() ?? true;
    const msg: PageToScene = {
      kind: 'set-selection',
      entity: value,
      position,
      rotation,
      alignToWorld,
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

  // Re-post when the "align to world" setting toggles, so the agent re-orients
  // the translate gizmo on the current selection.
  const offGizmos = gizmos?.onChange(post);

  return () => {
    off();
    offGizmos?.();
    channel.close();
  };
}
