import type { Entity } from '@dcl/ecs';

import type { SceneContext } from '../babylon/decentraland/SceneContext';
import { getAncestors, isAncestor, mapNodes } from '../sdk/nodes';
import type { PickTarget, RendererEvents } from './types';

/**
 * The inspector-side handler for the renderer's reverse channel.
 *
 * The renderer is a pure input/render device: it picks, classifies, and drags,
 * then *emits* what happened (`pick`, `gizmoCommit`). It never mutates ECS
 * itself. This module is the single place that turns those events into ECS
 * operations — the inspector owning every scene edit. A non-Babylon renderer
 * reuses this exact handler by emitting the same events.
 *
 * It writes through `context.operations` (the renderer's scene engine), which
 * is the same target the old in-renderer code used, so behavior is unchanged;
 * the change is purely *who* issues the write.
 */
export function connectReverseChannel(context: SceneContext): () => void {
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

  // Write the transforms but do NOT dispatch — a multi-entity drag emits one
  // gizmoCommit per entity, and the batch is flushed once on gizmoCommitEnd so
  // it stays a single engine update / undo step.
  function applyGizmoCommit(transforms: RendererEvents['gizmoCommit']['transforms']) {
    for (const t of transforms) {
      const current = context.Transform.getOrNull(t.entity);
      if (!current) continue;
      operations.updateValue(context.Transform, t.entity, {
        ...current,
        ...(t.position ? { position: t.position } : {}),
        ...(t.rotation ? { rotation: t.rotation } : {}),
        ...(t.scale ? { scale: t.scale } : {}),
      });
    }
  }

  const onPick = ({ target, modifiers }: RendererEvents['pick']) => applyPick(target, modifiers);
  const onGizmoCommit = ({ transforms }: RendererEvents['gizmoCommit']) =>
    applyGizmoCommit(transforms);
  const onGizmoCommitEnd = () => void operations.dispatch();

  context.rendererEvents.on('pick', onPick);
  context.rendererEvents.on('gizmoCommit', onGizmoCommit);
  context.rendererEvents.on('gizmoCommitEnd', onGizmoCommitEnd);

  return () => {
    context.rendererEvents.off('pick', onPick);
    context.rendererEvents.off('gizmoCommit', onGizmoCommit);
    context.rendererEvents.off('gizmoCommitEnd', onGizmoCommitEnd);
  };
}

// Re-export for callers that only need the entity-id type.
export type { Entity };
