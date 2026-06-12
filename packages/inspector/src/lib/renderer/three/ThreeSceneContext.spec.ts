import * as THREE from 'three';
import type { Entity } from '@dcl/ecs';

import { ThreeSceneContext } from './ThreeSceneContext';

/**
 * Proves the renderer boundary is engine-agnostic: a non-Babylon engine
 * (three.js) builds its scene graph from the same ECS component changes, with no
 * Babylon assumptions. Exercises the CRDT-subscriber core directly (no WebGL).
 */
describe('ThreeSceneContext', () => {
  let ctx: ThreeSceneContext;
  const noAssets = async () => null;

  beforeEach(() => {
    ctx = new ThreeSceneContext(noAssets);
  });

  afterEach(() => {
    ctx.dispose();
  });

  const IDENTITY = { rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };

  describe('when a Transform is added to an entity', () => {
    it('should create a three Object3D with the matching transform', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 2, z: 3 },
        parent: ctx.engine.RootEntity,
      });
      await ctx.engine.update(1);

      const obj = ctx.getObject(entity);
      expect(obj).toBeInstanceOf(THREE.Object3D);
      expect(obj!.position.toArray()).toEqual([1, 2, 3]);
    });
  });

  describe('when an entity has a parent transform', () => {
    it('should parent the child object under the parent object', async () => {
      const parent = ctx.engine.addEntity();
      const child = ctx.engine.addEntity();
      ctx.Transform.create(parent, {
        ...IDENTITY,
        position: { x: 0, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      ctx.Transform.create(child, { ...IDENTITY, position: { x: 5, y: 0, z: 0 }, parent });
      await ctx.engine.update(1);

      expect(ctx.getObject(child)!.parent).toBe(ctx.getObject(parent));
    });
  });

  describe('when a MeshRenderer is added', () => {
    it('should attach a renderable mesh to the entity object', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 0, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      ctx.MeshRenderer.create(entity, { mesh: { $case: 'box', box: { uvs: [] } } });
      await ctx.engine.update(1);

      const mesh = ctx.getObject(entity)!.getObjectByName('mesh');
      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });
  });

  describe('entity <-> object mapping (for picking and camera focus)', () => {
    it('should resolve an entity from any descendant object', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 0, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      ctx.MeshRenderer.create(entity, { mesh: { $case: 'box', box: { uvs: [] } } });
      await ctx.engine.update(1);

      const mesh = ctx.getObject(entity)!.getObjectByName('mesh')!;
      expect(ctx.getEntityFromObject(mesh)).toBe(entity);
    });
  });

  describe('when an entity is removed', () => {
    it('should remove its object from the scene graph', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 0, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      await ctx.engine.update(1);
      expect(ctx.getObject(entity)).not.toBeNull();

      ctx.engine.removeEntity(entity);
      await ctx.engine.update(1);

      expect(ctx.getObject(entity as Entity)).toBeNull();
    });
  });
});
