import * as BABYLON from '@babylonjs/core';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';

import { pickEntityAt } from '../../babylon/setup/input';
import type { RendererActivity, RendererActivityTracking, Unsubscribe } from '../types';

export const POINTER_TARGET_THROTTLE_MS = 100;

type PointerTarget = Omit<Extract<RendererActivity, { kind: 'pointerTarget' }>, 'kind'>;

/**
 * The pointer target at a viewport position. Babylon's scene space IS scene-local
 * metres (the scene root sits at the origin), so the picked point needs no conversion.
 * The mesh name is only reported for a mesh loaded from the entity's glTF: a
 * MeshRenderer primitive's name is a Babylon-generated label, not the creator's.
 */
export function pickPointerTarget(scene: BABYLON.Scene, x: number, y: number): PointerTarget {
  const picked = pickEntityAt(scene, x, y);
  if (picked === null) return { entity: null };
  const { entity, mesh, point } = picked;
  const target: PointerTarget = { entity: entity.entityId };
  if (point) target.point = DclVector3.create(point.x, point.y, point.z);
  if (entity.gltfContainer && mesh.isDescendantOf(entity.gltfContainer)) {
    target.meshName = mesh.name;
  }
  return target;
}

/**
 * Throttles pointer-target resolution to one per `throttleMs` — with a trailing call,
 * so where the pointer comes to rest is always reported — and emits only on a change
 * of entity or mesh. Engine-free so the timing rules are testable on their own.
 */
export function createPointerTargetReporter(options: {
  resolve: () => PointerTarget;
  emit: (activity: RendererActivity) => void;
  throttleMs?: number;
}): { pointerMoved(): void; pointerLeft(): void; dispose(): void } {
  const throttleMs = options.throttleMs ?? POINTER_TARGET_THROTTLE_MS;
  let lastKey: string | null = null;
  let lastRunAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const report = (target: PointerTarget) => {
    const key = target.entity === null ? 'none' : `${target.entity}|${target.meshName ?? ''}`;
    if (key === lastKey) return;
    lastKey = key;
    options.emit({ kind: 'pointerTarget', ...target });
  };

  const run = () => {
    timer = null;
    lastRunAt = Date.now();
    report(options.resolve());
  };

  return {
    pointerMoved: () => {
      if (timer !== null) return;
      const wait = lastRunAt + throttleMs - Date.now();
      if (wait <= 0) run();
      else timer = setTimeout(run, wait);
    },
    pointerLeft: () => {
      cancel();
      report({ entity: null });
    },
    dispose: cancel,
  };
}

/**
 * Babylon's {@link RendererActivityTracking}: the pointer target only — Babylon
 * doesn't run the scene, so there are no scene clicks or player moves. A camera move
 * under a resting pointer also re-resolves, since flying the camera changes what the
 * pointer is over without a pointer event.
 */
export function createBabylonActivityTracking(
  scene: BABYLON.Scene,
  camera: BABYLON.Camera,
): RendererActivityTracking {
  return {
    track: (cb): Unsubscribe => {
      let pointerInside = false;
      const reporter = createPointerTargetReporter({
        resolve: () => pickPointerTarget(scene, scene.pointerX, scene.pointerY),
        emit: cb,
      });
      const pointerObserver = scene.onPointerObservable.add(e => {
        if (e.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;
        pointerInside = true;
        reporter.pointerMoved();
      });
      const cameraObserver = camera.onViewMatrixChangedObservable.add(() => {
        if (pointerInside) reporter.pointerMoved();
      });
      const canvas = scene.getEngine().getRenderingCanvas();
      const onPointerLeave = () => {
        pointerInside = false;
        reporter.pointerLeft();
      };
      canvas?.addEventListener('pointerleave', onPointerLeave);
      return () => {
        scene.onPointerObservable.remove(pointerObserver);
        camera.onViewMatrixChangedObservable.remove(cameraObserver);
        canvas?.removeEventListener('pointerleave', onPointerLeave);
        reporter.dispose();
      };
    },
  };
}
