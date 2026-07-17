import type { Entity } from '@dcl/ecs';

import { BevySceneContext } from './BevySceneContext';

/**
 * Proves the Bevy renderer's CRDT-subscriber core projects ECS state the same
 * way Babylon and Three do — the engine-agnostic half that needs no wasm. It
 * exercises the boundary the inspector's CRDT stream feeds (Transform in →
 * world positions out), which is what the {@link IRenderer} viewport getter
 * answers from.
 */
describe('BevySceneContext', () => {
  let ctx: BevySceneContext;

  const IDENTITY = { rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };

  beforeEach(() => {
    ctx = new BevySceneContext();
  });

  afterEach(() => {
    ctx.dispose();
  });

  describe('when a Transform is added to an entity', () => {
    it('should track its world position', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 2, z: 3 },
        parent: ctx.engine.RootEntity,
      });
      await ctx.engine.update(1);

      const positions = ctx.getEntityWorldPositions([entity]);
      expect(positions.get(entity)).toEqual({ x: 1, y: 2, z: 3 });
    });
  });

  describe('when an entity has a parent transform', () => {
    it('should resolve the child world position through the parent chain', async () => {
      const parent = ctx.engine.addEntity();
      const child = ctx.engine.addEntity();
      ctx.Transform.create(parent, {
        ...IDENTITY,
        position: { x: 10, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      ctx.Transform.create(child, { ...IDENTITY, position: { x: 5, y: 0, z: 0 }, parent });
      await ctx.engine.update(1);

      // child world = parent (10) + child local (5) = 15 on x
      expect(ctx.getEntityWorldPositions([child]).get(child)).toEqual({ x: 15, y: 0, z: 0 });
    });
  });

  describe('worldToLocalPosition', () => {
    it('should subtract the parent world position for a nested child', async () => {
      const parent = ctx.engine.addEntity();
      const child = ctx.engine.addEntity();
      ctx.Transform.create(parent, {
        ...IDENTITY,
        position: { x: 10, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      ctx.Transform.create(child, { ...IDENTITY, position: { x: 5, y: 0, z: 0 }, parent });
      await ctx.engine.update(1);

      // A gizmo drop at world (15,0,0) must become local (5,0,0) for the child so
      // it doesn't jump by the parent's offset when written to Transform.position.
      expect(ctx.worldToLocalPosition(child, { x: 15, y: 0, z: 0 })).toEqual({ x: 5, y: 0, z: 0 });
    });

    it('should pass a root-parented entity through unchanged', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 3, y: 0, z: 4 },
        parent: ctx.engine.RootEntity,
      });
      await ctx.engine.update(1);
      expect(ctx.worldToLocalPosition(entity, { x: 8, y: 1, z: 9 })).toEqual({ x: 8, y: 1, z: 9 });
    });
  });

  describe('getEntityWorldPositions', () => {
    it('should omit entities with no tracked transform (per contract)', () => {
      const positions = ctx.getEntityWorldPositions([987654 as Entity]);
      expect(positions.has(987654 as Entity)).toBe(false);
    });
  });

  describe('when an entity is removed', () => {
    it('should drop its world position', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 1, z: 1 },
        parent: ctx.engine.RootEntity,
      });
      await ctx.engine.update(1);
      expect(ctx.getEntityWorldPositions([entity]).has(entity)).toBe(true);

      ctx.engine.removeEntity(entity);
      await ctx.engine.update(1);
      expect(ctx.getEntityWorldPositions([entity]).has(entity)).toBe(false);
    });
  });

  describe('onFrame', () => {
    it('should invoke subscribers on tick and stop after unsubscribe', () => {
      let calls = 0;
      const off = ctx.onFrame(() => {
        calls++;
      });
      ctx.tick();
      expect(calls).toBe(1);
      off();
      ctx.tick();
      expect(calls).toBe(1);
    });
  });

  describe('getGroundPlanes', () => {
    it('should return [] when the scene has no layout', () => {
      expect(ctx.getGroundPlanes()).toEqual([]);
    });

    it('should map layout parcels to base-relative world centers (scene at origin)', () => {
      // Scene based at parcel (10, 20) with two parcels; the scene renders at the
      // origin, so parcels are placed relative to the base and each ground plane
      // is the parcel CENTER (grid*16 + 8).
      ctx.editorComponents.Scene.createOrReplace(ctx.engine.RootEntity, {
        layout: {
          base: { x: 10, y: 20 },
          parcels: [
            { x: 10, y: 20 }, // base parcel → (0*16+8, 0*16+8) = (8, 8)
            { x: 11, y: 20 }, // one east → (1*16+8, 0*16+8) = (24, 8)
          ],
        },
      } as never);

      expect(ctx.getGroundPlanes()).toEqual([
        { x: 8, z: 8 },
        { x: 24, z: 8 },
      ]);
    });
  });
});
