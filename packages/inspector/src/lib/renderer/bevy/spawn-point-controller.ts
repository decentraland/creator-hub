import mitt from 'mitt';
import type { Vector3 } from '@dcl/ecs-math';

import type { SpawnPointController, SpawnPointTarget, Unsubscribe } from '../types';

/**
 * The Bevy renderer's spawn-point controller. A spawn point is scene METADATA
 * (edited via the PlayerInspector form), not a CRDT entity — so this owns:
 *
 *  - Selection + visibility STATE (which spawn point / target is selected, which
 *    names are hidden) that drives the hierarchy tree UI. Renderer-independent
 *    plain state + change events, mirroring the Babylon spawn-point manager.
 *  - A position-only 3D gizmo: `attachGizmo` asks the editor agent (over the bus,
 *    via the injected `postGizmo`) to show a move-handle at the supplied world
 *    position; the agent reports drags back through `onSpawnGizmoCommit`, which
 *    this routes to the caller's `onPositionChange`. No rotation/scale — spawn
 *    points and camera targets are points.
 *
 * The inspector owns the spawn-point data + positions; this only mirrors the
 * selection state and brokers the drag handle, exactly like the gizmo bridge for
 * regular entities.
 */

type Events = {
  selectionChange: { index: number | null; target: SpawnPointTarget | null };
  visibilityChange: { name: string; visible: boolean };
};

export interface SpawnPointGizmoPoster {
  /** Show a position handle at a world position (null hides it). */
  show(position: { x: number; y: number; z: number } | null): void;
}

/**
 * Resolve a spawn point's (or its camera target's) current scene-local position
 * from the Scene metadata. The inspector attaches the gizmo without pushing a
 * position (unlike Babylon, whose renderer already holds the built meshes), so
 * the controller reads it here to place the handle. Null if unavailable.
 */
export type SpawnPositionResolver = (
  index: number,
  target: SpawnPointTarget,
) => { x: number; y: number; z: number } | null;

export interface BevySpawnPointController extends SpawnPointController {
  /** Route an agent-reported spawn-gizmo drag to the active onPositionChange. */
  handleGizmoCommit(position: { x: number; y: number; z: number }): void;
  /**
   * Re-resolve the attached spawn point's position and re-show the handle. Call
   * when the Scene metadata changes (a form edit, or the commit round-trip) so
   * the handle tracks the data — the inspector never pushes on those paths.
   */
  refreshHandle(): void;
}

export function createSpawnPointController(
  poster: SpawnPointGizmoPoster,
  resolvePosition: SpawnPositionResolver,
): BevySpawnPointController {
  const events = mitt<Events>();

  let selectedIndex: number | null = null;
  let selectedTarget: SpawnPointTarget | null = null;
  const hiddenNames = new Set<string>();

  // The active gizmo attachment: which spawn point/target is being dragged, and
  // the callback to report new positions to (the PlayerInspector form applies it).
  let gizmoIndex: number | null = null;
  let gizmoTarget: SpawnPointTarget = 'position';
  let onPositionChange: ((index: number, position: Vector3) => void) | null = null;

  return {
    getSelectedIndex: () => selectedIndex,
    getSelectedTarget: () => selectedTarget,
    isHidden: (name: string) => hiddenNames.has(name),

    select: (index: number | null) => {
      selectedIndex = index;
      selectedTarget = index === null ? null : 'position';
      events.emit('selectionChange', { index, target: selectedTarget });
    },
    selectCameraTarget: (index: number) => {
      selectedIndex = index;
      selectedTarget = 'cameraTarget';
      events.emit('selectionChange', { index, target: 'cameraTarget' });
    },
    setVisible: (_index: number, name: string, visible: boolean) => {
      if (visible) hiddenNames.delete(name);
      else hiddenNames.add(name);
      events.emit('visibilityChange', { name, visible });
    },
    onSelectionChange: (cb): Unsubscribe => {
      events.on('selectionChange', cb);
      return () => events.off('selectionChange', cb);
    },
    onVisibilityChange: (cb): Unsubscribe => {
      events.on('visibilityChange', cb);
      return () => events.off('visibilityChange', cb);
    },

    attachGizmo: (index, target, cb) => {
      // Unlike Babylon, the inspector doesn't push a position on attach — resolve
      // it from the Scene metadata and show the handle right away.
      gizmoIndex = index;
      gizmoTarget = target;
      onPositionChange = cb;
      const pos = resolvePosition(index, target);
      poster.show(pos);
    },
    detachGizmo: () => {
      gizmoIndex = null;
      onPositionChange = null;
      poster.show(null);
    },
    setPosition: (index, target, position) => {
      // Move the handle for the attached spawn point (e.g. a form edit or an
      // out-of-bounds correction). Only the attached index/target drives the
      // visible handle.
      if (index === gizmoIndex && target === gizmoTarget) {
        poster.show({ x: position.x, y: position.y, z: position.z });
      }
    },

    handleGizmoCommit: position => {
      if (gizmoIndex !== null && onPositionChange !== null) {
        onPositionChange(gizmoIndex, position as unknown as Vector3);
      }
    },

    refreshHandle: () => {
      if (gizmoIndex === null) return;
      poster.show(resolvePosition(gizmoIndex, gizmoTarget));
    },
  };
}
