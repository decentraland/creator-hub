import type { Entity } from '@dcl/ecs';

import { EDITOR_BUS_CHANNEL } from '@dcl/inspector-bevy-protocol';
import type { BusEnvelope, PageToScene } from '@dcl/inspector-bevy-protocol';
import type { BevySceneContext } from './BevySceneContext';

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
  /** Test seam: the channel to post on. Defaults to a real BroadcastChannel. */
  channel?: Channel;
}

export function createSelectionBridge(options: SelectionBridgeOptions): () => void {
  const { context } = options;
  const channel = options.channel ?? (new BroadcastChannel(EDITOR_BUS_CHANNEL) as Channel);
  const Selection = context.editorComponents.Selection;

  let lastPosted: number | null | undefined;

  const post = () => {
    // Current selection = entities carrying the Selection component. Single-entity
    // gizmo → take the first (or null when nothing is selected).
    let entity: Entity | null = null;
    for (const [e] of context.engine.getEntitiesWith(Selection)) {
      entity = e;
      break;
    }
    const value = entity === null ? null : (entity as number);
    if (value === lastPosted) return; // only post on change
    lastPosted = value;
    // Send the entity's world position too: the agent scene can't read the
    // inspected scene's Transform from its own engine, so the inspector (which
    // owns the CRDT) supplies where to place the gizmo.
    const wp =
      entity === null ? null : (context.getEntityWorldPositions([entity]).get(entity) ?? null);
    const position = wp === null ? null : { x: wp.x, y: wp.y, z: wp.z };
    const msg: PageToScene = { kind: 'set-selection', entity: value, position };
    const envelope: BusEnvelope = { to: 'scene', msg };
    channel.postMessage(envelope);
  };

  // Post whenever a Selection component is added/removed.
  const off = context.onChange((_entity, _op, component) => {
    if (component && component.componentId === Selection.componentId) post();
  });

  return () => {
    off();
    channel.close();
  };
}
