import type { Emitter } from 'mitt';
import type { IEngine, TransformType } from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/ecs-math';

import type { createOperations } from '../sdk/operations';
import type { EditorComponents, SdkComponents } from '../sdk/components';
import { getAncestors, isAncestor, mapNodes } from '../sdk/nodes';
import {
  snapPositionValue,
  snapRotationValue,
  snapScaleValue,
} from '../babylon/decentraland/snap-manager';
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
// A multiplicative scale gizmo can never recover a zero scale (0 × factor = 0),
// and a drag can otherwise produce one (a tiny factor, or the snap step rounding
// a small result to 0). Like Babylon's ScaleGizmo `minScaleValue`, keep both the
// base and the merged result at least MIN_SCALE in magnitude, preserving sign
// (0 counts as positive).
const MIN_SCALE = 0.01;

function clampScaleComponent(value: number): number {
  if (Math.abs(value) >= MIN_SCALE) return value;
  return value < 0 ? -MIN_SCALE : MIN_SCALE;
}

function clampScale(scale: { x: number; y: number; z: number }) {
  return {
    x: clampScaleComponent(scale.x),
    y: clampScaleComponent(scale.y),
    z: clampScaleComponent(scale.z),
  };
}

export interface ReverseChannelOptions {
  /**
   * How the renderer's `gizmoCommit` expresses rotation + scale:
   *  - `false` (default): ABSOLUTE — the committed value IS the entity's new
   *    rotation/scale (Babylon drags the local node and emits its final value).
   *    The merge SETS them.
   *  - `true`: DELTAS — a renderer that can't read the entity's base transform
   *    (the Bevy agent, in a separate engine) sends rotation as a WORLD-frame
   *    delta quaternion and scale as a per-axis multiplier. The merge COMPOSES
   *    (delta ⊗ current) / MULTIPLIES onto the current value.
   * Position is ABSOLUTE in both modes (the anchor is known up front).
   */
  gizmoDeltas?: boolean;
}

export function connectReverseChannel(
  context: ReverseChannelTarget,
  options: ReverseChannelOptions = {},
): () => void {
  const { engine, operations, editorComponents } = context;
  const gizmoDeltas = options.gizmoDeltas ?? false;

  function applyPick(target: PickTarget, modifiers: { multi: boolean }) {
    switch (target.kind) {
      case 'entity': {
        // Locked entities can't be selected by clicking in the viewport (e.g. a
        // default ground is locked so it isn't moved by accident) — matching
        // Babylon, where a locked entity's gizmo won't attach. Ignore the pick.
        const lock = editorComponents.Lock.getOrNull(target.entity);
        if (lock?.value) break;
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

  // A gizmoCommit writes Transforms but defers dispatch: a drag emits one commit
  // per entity and the batch is flushed once on gizmoCommitEnd, keeping it a
  // single engine update / undo step. `pendingCommit` guards against a renderer
  // that emits commits but never the matching End (an exception mid-drag, a
  // dropped out-of-process message, a buggy third-party renderer) — which would
  // otherwise leave a written-but-unflushed Transform that the next unrelated
  // dispatch silently absorbs, corrupting undo history.
  let pendingCommit = false;

  function flushPending() {
    if (!pendingCommit) return;
    pendingCommit = false;
    void operations.dispatch();
  }

  // Merge a renderer's gizmo commit onto an entity's current Transform. Position
  // is always ABSOLUTE (the anchor is known up front). Rotation + scale depend on
  // `gizmoDeltas`:
  //  - absolute (Babylon): the committed value IS the new rotation/scale — SET it.
  //  - delta (Bevy agent, separate engine, can't read the base): rotation is a
  //    WORLD-frame delta quaternion (new = delta ⊗ current — for a locally-aligned
  //    ring the normal is the entity's rotated axis, so the same composition
  //    applies the delta about the local axis); scale is a per-axis multiplier.
  // Values are snapped AUTHORITATIVELY here when the editor's snap is enabled —
  // the renderer only quantizes its feedback; the merge quantizes where it lands.
  function mergeTransform(
    current: TransformType,
    t: {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number; w: number };
      scale?: { x: number; y: number; z: number };
    },
  ): TransformType {
    const position = t.position ? snapPositionValue(t.position) : undefined;
    const rotation = t.rotation
      ? snapRotationValue(
          gizmoDeltas ? Quaternion.multiply(t.rotation, current.rotation) : t.rotation,
        )
      : undefined;
    // Scale: clamp away from 0 first (so a zeroed entity is recoverable). In delta
    // mode multiply onto the current scale; in absolute mode use the value as-is.
    // Snap, then clamp again (snapping can round a small result back to 0).
    const scale = t.scale
      ? clampScale(
          snapScaleValue(
            gizmoDeltas ? Vector3.multiply(clampScale(current.scale), t.scale) : t.scale,
          ),
        )
      : undefined;
    return {
      ...current,
      ...(position ? { position } : {}),
      ...(rotation ? { rotation } : {}),
      ...(scale ? { scale } : {}),
    };
  }

  function applyGizmoCommit(transforms: RendererEvents['gizmoCommit']['transforms']) {
    for (const t of transforms) {
      const current = context.Transform.getOrNull(t.entity);
      if (!current) continue;
      pendingCommit = true;
      operations.updateValue(context.Transform, t.entity, mergeTransform(current, t));
    }
  }

  // Live (mid-drag) preview: merge the delta onto the current Transform exactly
  // like a commit, but emit the absolute result as `previewTransforms` instead of
  // writing the CRDT. An out-of-process renderer (Bevy) previews these in its
  // engine directly, so the entity tracks the gizmo every frame WITHOUT a CRDT
  // write / undo entry per frame — the authoritative write is the drag-end commit.
  function applyGizmoPreview(transforms: RendererEvents['gizmoDrag']['transforms']) {
    const merged: RendererEvents['previewTransforms']['transforms'] = [];
    for (const t of transforms) {
      const current = context.Transform.getOrNull(t.entity);
      if (!current) continue;
      const m = mergeTransform(current, t);
      merged.push({
        entity: t.entity,
        position: m.position,
        rotation: m.rotation,
        scale: m.scale,
        parent: m.parent,
      });
    }
    if (merged.length > 0) context.rendererEvents.emit('previewTransforms', { transforms: merged });
  }

  // Any pick mid-drag flushes the pending gizmo batch first, so its write can't
  // be silently folded into the selection dispatch.
  const onPick = ({ target, modifiers }: RendererEvents['pick']) => {
    flushPending();
    applyPick(target, modifiers);
  };
  const onGizmoCommit = ({ transforms }: RendererEvents['gizmoCommit']) =>
    applyGizmoCommit(transforms);
  const onGizmoPreview = ({ transforms }: RendererEvents['gizmoDrag']) =>
    applyGizmoPreview(transforms);
  const onGizmoCommitEnd = () => flushPending();

  context.rendererEvents.on('pick', onPick);
  context.rendererEvents.on('gizmoCommit', onGizmoCommit);
  context.rendererEvents.on('gizmoDrag', onGizmoPreview);
  context.rendererEvents.on('gizmoCommitEnd', onGizmoCommitEnd);

  return () => {
    // Flush any drag still in flight at teardown rather than stranding the write.
    flushPending();
    context.rendererEvents.off('pick', onPick);
    context.rendererEvents.off('gizmoCommit', onGizmoCommit);
    context.rendererEvents.off('gizmoDrag', onGizmoPreview);
    context.rendererEvents.off('gizmoCommitEnd', onGizmoCommitEnd);
  };
}
