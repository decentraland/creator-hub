import type { Emitter } from 'mitt';
import type { IEngine } from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/ecs-math';

import type { createOperations } from '../sdk/operations';
import type { EditorComponents, SdkComponents } from '../sdk/components';
import { getAncestors, isAncestor, mapNodes } from '../sdk/nodes';
import type { PickTarget, RendererEvents } from './types';

/**
 * The minimal surface the reverse-channel handler needs from a renderer's scene
 * engine: an `@dcl/ecs` engine plus engine-bound operations, editor components,
 * the Transform component, and an event bus. Babylon's SceneContext satisfies
 * this; any renderer provides the same shape. Keeping it an interface — not the
 * Babylon SceneContext — is what lets any renderer reuse the handler.
 */
export interface ReverseChannelTarget {
  engine: IEngine;
  operations: ReturnType<typeof createOperations>;
  editorComponents: EditorComponents;
  Transform: SdkComponents['Transform'];
  rendererEvents: Emitter<RendererEvents>;
}

/**
 * The inspector-side handler for the renderer's reverse channel.
 *
 * The renderer is a pure input/render device: it picks, classifies, and drags,
 * then *emits* what happened (`pick`, `gizmoCommit`). It never mutates ECS
 * itself. This module is the single place that turns those events into ECS
 * operations — the inspector owning every scene edit. Any renderer reuses this
 * exact handler by emitting the same events against its own scene engine.
 */
export function connectReverseChannel(context: ReverseChannelTarget): () => void {
  const { engine, operations, editorComponents } = context;

  function applyPick(target: PickTarget, modifiers: { multi: boolean }) {
    switch (target.kind) {
      case 'entity': {
        // Expand the clicked entity's ancestors in the tree, then select it.
        const ancestors = getAncestors(engine, target.entity);
        const nodes = mapNodes(engine, node =>
          isAncestor(ancestors, node.entity) ? { ...node, open: true } : node,
        );
        operations.updateValue(editorComponents.Nodes, engine.RootEntity, { value: nodes });
        operations.updateSelectedEntity(target.entity, modifiers.multi);
        // Selecting an entity clears any spawn-point selection (renderer-side
        // spawn state is already cleared by the renderer before emitting).
        void operations.dispatch();
        break;
      }
      case 'spawnPoint': {
        // The renderer already updated its own spawn-point selection; mirror it
        // into ECS selection (Player when a spawn point is selected, Root when
        // toggled off).
        operations.updateSelectedEntity(target.selected ? engine.PlayerEntity : engine.RootEntity);
        void operations.dispatch();
        break;
      }
      case 'empty': {
        operations.updateSelectedEntity(engine.RootEntity);
        void operations.dispatch();
        break;
      }
    }
  }

  // A gizmoCommit writes Transforms but defers dispatch: a multi-entity drag
  // emits one commit per entity and the batch is flushed once on gizmoCommitEnd,
  // keeping it a single engine update / undo step. `pendingCommit` guards
  // against a renderer that emits commits but never the matching End (an
  // exception mid-drag, a dropped out-of-process message, a buggy third-party
  // renderer) — which would otherwise leave a written-but-unflushed Transform
  // that the next unrelated dispatch silently absorbs, corrupting undo history.
  let pendingCommit = false;

  function flushPending() {
    if (!pendingCommit) return;
    pendingCommit = false;
    void operations.dispatch();
  }

  function applyGizmoCommit(transforms: RendererEvents['gizmoCommit']['transforms']) {
    for (const t of transforms) {
      const current = context.Transform.getOrNull(t.entity);
      if (!current) continue;
      pendingCommit = true;
      // A renderer that can't read the entity's base transform (e.g. the Bevy
      // agent, which lives in a separate engine) sends a gizmo drag as a DELTA:
      // - position is absolute (the renderer is given the world anchor up front);
      // - rotation is a delta quaternion, composed onto the current rotation;
      // - scale is a per-axis multiplier, applied to the current scale.
      // Composing here (where we own the real Transform) keeps the untouched
      // fields exact and needs a single write per drag (the renderer commits once
      // on release), so deltas don't accumulate.
      const rotation = t.rotation ? Quaternion.multiply(current.rotation, t.rotation) : undefined;
      const scale = t.scale ? Vector3.multiply(current.scale, t.scale) : undefined;
      operations.updateValue(context.Transform, t.entity, {
        ...current,
        ...(t.position ? { position: t.position } : {}),
        ...(rotation ? { rotation } : {}),
        ...(scale ? { scale } : {}),
      });
    }
  }

  // Any pick mid-drag flushes the pending gizmo batch first, so its write can't
  // be silently folded into the selection dispatch.
  const onPick = ({ target, modifiers }: RendererEvents['pick']) => {
    flushPending();
    applyPick(target, modifiers);
  };
  const onGizmoCommit = ({ transforms }: RendererEvents['gizmoCommit']) =>
    applyGizmoCommit(transforms);
  const onGizmoCommitEnd = () => flushPending();

  context.rendererEvents.on('pick', onPick);
  context.rendererEvents.on('gizmoCommit', onGizmoCommit);
  context.rendererEvents.on('gizmoCommitEnd', onGizmoCommitEnd);

  return () => {
    // Flush any drag still in flight at teardown rather than stranding the write.
    flushPending();
    context.rendererEvents.off('pick', onPick);
    context.rendererEvents.off('gizmoCommit', onGizmoCommit);
    context.rendererEvents.off('gizmoCommitEnd', onGizmoCommitEnd);
  };
}
