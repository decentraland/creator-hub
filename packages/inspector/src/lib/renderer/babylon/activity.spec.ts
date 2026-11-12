import * as BABYLON from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';

import { EcsEntity } from '../../babylon/decentraland/EcsEntity';
import type { SceneContext } from '../../babylon/decentraland/SceneContext';
import type { RendererActivity } from '../types';
import {
  POINTER_TARGET_THROTTLE_MS,
  createBabylonActivityTracking,
  createPointerTargetReporter,
  pickPointerTarget,
} from './activity';

describe('createPointerTargetReporter', () => {
  let target: { entity: Entity | null; meshName?: string };
  let resolve: ReturnType<typeof vi.fn>;
  let emitted: RendererActivity[];
  let reporter: ReturnType<typeof createPointerTargetReporter>;

  beforeEach(() => {
    vi.useFakeTimers();
    target = { entity: 512 as Entity };
    resolve = vi.fn(() => ({ ...target }));
    emitted = [];
    reporter = createPointerTargetReporter({ resolve, emit: a => emitted.push(a) });
  });

  afterEach(() => {
    reporter.dispose();
    vi.useRealTimers();
  });

  describe('when the pointer first moves', () => {
    it('should report the target at once', () => {
      reporter.pointerMoved();
      expect(emitted).toEqual([{ kind: 'pointerTarget', entity: 512 }]);
    });
  });

  describe('when the pointer keeps moving over the same entity', () => {
    it('should not report it again', () => {
      reporter.pointerMoved();
      vi.advanceTimersByTime(POINTER_TARGET_THROTTLE_MS * 3);
      reporter.pointerMoved();
      expect(emitted).toHaveLength(1);
    });
  });

  describe('when the pointer moves to another mesh of the same entity', () => {
    it('should report the new mesh', () => {
      target = { entity: 512 as Entity, meshName: 'Door' };
      reporter.pointerMoved();
      target = { entity: 512 as Entity, meshName: 'Handle' };
      vi.advanceTimersByTime(POINTER_TARGET_THROTTLE_MS);
      reporter.pointerMoved();
      expect(emitted.map(a => (a as { meshName?: string }).meshName)).toEqual(['Door', 'Handle']);
    });
  });

  describe('when moves arrive faster than the throttle', () => {
    beforeEach(() => {
      reporter.pointerMoved();
      target = { entity: 600 as Entity };
      reporter.pointerMoved();
      reporter.pointerMoved();
    });

    it('should resolve once more, after the throttle window', () => {
      expect(resolve).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(POINTER_TARGET_THROTTLE_MS);
      expect(resolve).toHaveBeenCalledTimes(2);
    });

    it('should report where the pointer came to rest', () => {
      vi.advanceTimersByTime(POINTER_TARGET_THROTTLE_MS);
      expect(emitted.at(-1)).toEqual({ kind: 'pointerTarget', entity: 600 });
    });
  });

  describe('when the pointer leaves the viewport', () => {
    beforeEach(() => {
      reporter.pointerMoved();
      target = { entity: 600 as Entity };
      reporter.pointerMoved();
      reporter.pointerLeft();
    });

    it('should report nothing under the pointer', () => {
      expect(emitted.at(-1)).toEqual({ kind: 'pointerTarget', entity: null });
    });

    it('should drop the pending trailing resolve', () => {
      vi.advanceTimersByTime(POINTER_TARGET_THROTTLE_MS);
      expect(resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the pointer leaves twice', () => {
    it('should report nothing only once', () => {
      reporter.pointerLeft();
      reporter.pointerLeft();
      expect(emitted).toEqual([{ kind: 'pointerTarget', entity: null }]);
    });
  });
});

describe('Babylon pointer-target picking', () => {
  let scene: BABYLON.Scene;
  let camera: BABYLON.FreeCamera;
  let entity: EcsEntity;
  let center: { x: number; y: number };

  beforeEach(() => {
    const engine = new BABYLON.NullEngine({
      renderWidth: 200,
      renderHeight: 200,
      textureSize: 512,
      deterministicLockstep: false,
      lockstepMaxSteps: 1,
    });
    scene = new BABYLON.Scene(engine);
    camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(8, 1, -10), scene);
    camera.setTarget(new BABYLON.Vector3(8, 1, 8));
    const context = { deref: () => undefined } as unknown as WeakRef<SceneContext>;
    entity = new EcsEntity(512 as Entity, context, scene);
    entity.position.set(8, 1, 8);
    center = { x: 100, y: 100 };
  });

  afterEach(() => {
    scene.dispose();
    scene.getEngine().dispose();
  });

  const addBox = (name: string, parent: BABYLON.Node) => {
    const box = BABYLON.MeshBuilder.CreateBox(name, { size: 2 }, scene);
    box.parent = parent;
    return box;
  };
  const pick = () => {
    scene.render();
    return pickPointerTarget(scene, center.x, center.y);
  };

  describe('when the pointer is over an entity mesh', () => {
    it('should report the entity and the scene-local hit point', () => {
      addBox('box', entity);
      const target = pick();
      expect(target.entity).toBe(512);
      expect(target.point?.x).toBeCloseTo(8);
      expect(target.point?.y).toBeCloseTo(1);
      expect(target.point?.z).toBeCloseTo(7);
    });

    it('should not report a mesh name for a MeshRenderer primitive', () => {
      addBox('box', entity);
      expect(pick().meshName).toBeUndefined();
    });
  });

  describe('when the pointer is over a mesh loaded from the entity glTF', () => {
    it('should report the glTF mesh name', () => {
      const gltfRoot = new BABYLON.Mesh('__root__', scene);
      gltfRoot.parent = entity;
      entity.setGltfContainer(gltfRoot);
      addBox('Door_01', gltfRoot);
      expect(pick()).toMatchObject({ entity: 512, meshName: 'Door_01' });
    });
  });

  describe('when the pointer is over a mesh outside any entity', () => {
    it('should report nothing', () => {
      const helper = BABYLON.MeshBuilder.CreateBox('grid', { size: 2 }, scene);
      helper.position.set(8, 1, 8);
      expect(pick()).toEqual({ entity: null });
    });
  });

  describe('when the pointer is over empty space', () => {
    it('should report nothing', () => {
      expect(pick()).toEqual({ entity: null });
    });
  });

  describe('when tracking is unsubscribed', () => {
    it('should remove its pointer and camera observers', async () => {
      const tracking = createBabylonActivityTracking(scene, camera);
      const pointerObservers = scene.onPointerObservable.observers.length;
      const cameraObservers = camera.onViewMatrixChangedObservable.observers.length;
      const off = tracking.track(() => {});
      expect(scene.onPointerObservable.observers.length).toBe(pointerObservers + 1);
      expect(camera.onViewMatrixChangedObservable.observers.length).toBe(cameraObservers + 1);
      off();
      // Observable.remove splices on a timeout, not synchronously.
      await new Promise(r => setTimeout(r, 0));
      expect(scene.onPointerObservable.observers.length).toBe(pointerObservers);
      expect(camera.onViewMatrixChangedObservable.observers.length).toBe(cameraObservers);
    });
  });
});
