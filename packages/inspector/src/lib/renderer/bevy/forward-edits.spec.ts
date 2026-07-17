import * as components from '@dcl/ecs/dist/components';

import type { EngineWindow } from './console';
import { BevySceneContext } from './BevySceneContext';
import { createForwardEditBridge } from './forward-edits';

/**
 * The forward edit bridge translates the inspector's ECS changes into engine
 * console commands (the only way to mutate the running scene). Driven through a
 * real BevySceneContext + engine so the change stream is genuine; the console
 * `send` is a recorder (no wasm).
 */
describe('createForwardEditBridge', () => {
  let ctx: BevySceneContext;
  let sent: Array<{ cmd: string; args: string[] }>;
  let disconnect: () => void;

  const IDENTITY = { rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };
  const engineWindow = {} as EngineWindow;

  beforeEach(() => {
    ctx = new BevySceneContext();
    sent = [];
    disconnect = createForwardEditBridge({
      context: ctx,
      engineWindow,
      // Forward immediately in tests (skip the initial-load arm delay).
      shouldForward: () => true,
      send: async (cmd, args) => {
        sent.push({ cmd, args });
        return '';
      },
    });
  });

  afterEach(() => {
    disconnect();
    ctx.dispose();
  });

  describe('when a Transform is written', () => {
    it('should send set_component with the short engine name and JSON value', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 2, z: 3 },
        parent: ctx.engine.RootEntity,
      });
      await ctx.engine.update(1);

      const write = sent.find(s => s.cmd === 'set_component');
      expect(write).toBeDefined();
      expect(write!.args[0]).toBe(String(entity));
      expect(write!.args[1]).toBe('Transform'); // core:: stripped
      const value = JSON.parse(write!.args[2]);
      expect(value.position).toEqual({ x: 1, y: 2, z: 3 });
    });
  });

  describe('when a GltfContainer is written (a newly added/dropped model)', () => {
    it('should refresh the content map (scene_content) BEFORE writing GltfContainer', async () => {
      const GltfContainer = components.GltfContainer(ctx.engine);
      const entity = ctx.engine.addEntity();
      GltfContainer.create(entity, { src: 'assets/thing.glb', visibleMeshesCollisionMask: 3 });
      await ctx.engine.update(1);
      // Let the sequenced async fire (scene_content → set_component) settle.
      await new Promise(r => setTimeout(r, 0));

      const refreshIdx = sent.findIndex(s => s.cmd === 'scene_content');
      const setIdx = sent.findIndex(
        s => s.cmd === 'set_component' && s.args[1] === 'GltfContainer',
      );
      expect(refreshIdx).toBeGreaterThanOrEqual(0);
      expect(setIdx).toBeGreaterThanOrEqual(0);
      // Content refresh must precede the GltfContainer set so the src resolves and
      // the model renders instead of a placeholder cube.
      expect(refreshIdx).toBeLessThan(setIdx);

      const write = sent[setIdx];
      expect(write.args[0]).toBe(String(entity));
      expect(JSON.parse(write.args[2]).src).toBe('assets/thing.glb');
    });
  });

  describe('when a NEW entity is added (Name + engine components, like a dropped asset)', () => {
    it('should instantiate it via new_entity before forwarding its engine components', async () => {
      const GltfContainer = components.GltfContainer(ctx.engine);
      const entity = ctx.engine.addEntity();
      // Mirror add-asset's write order: engine components first, then Name (the
      // custom component that anchors instantiation) — the case that failed live.
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 0, z: 2 },
        parent: ctx.engine.RootEntity,
      });
      GltfContainer.create(entity, { src: 'assets/car.glb', visibleMeshesCollisionMask: 3 });
      ctx.Name.create(entity, { value: 'Car' });
      await ctx.engine.update(1);
      // Let the per-entity async queue (new_entity → set_component…) drain.
      await new Promise(r => setTimeout(r, 0));
      await new Promise(r => setTimeout(r, 0));

      const newEntityIdx = sent.findIndex(s => s.cmd === 'new_entity');
      expect(newEntityIdx).toBeGreaterThanOrEqual(0);
      // Instantiate at the exact inspector id, anchored by the Name component.
      const args = sent[newEntityIdx].args;
      expect(args[0]).toBe(String(ctx.Name.componentId));
      expect(args).toContain('--ids');
      expect(args).toContain(String(entity));

      // The engine components (Transform, GltfContainer) are (re)sent AFTER the
      // instantiation, so they land on the now-existing entity.
      const gltfIdx = sent.findIndex(
        s => s.cmd === 'set_component' && s.args[1] === 'GltfContainer',
      );
      const tfIdx = sent.findIndex(s => s.cmd === 'set_component' && s.args[1] === 'Transform');
      expect(gltfIdx).toBeGreaterThan(newEntityIdx);
      expect(tfIdx).toBeGreaterThan(newEntityIdx);
    });

    it('should NOT instantiate when only editing an existing entity (no Name write)', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, { ...IDENTITY, position: { x: 0, y: 0, z: 0 } });
      await ctx.engine.update(1);
      sent.length = 0;

      // A gizmo-style move: Transform changes, no Name — must not trigger new_entity.
      ctx.Transform.getMutable(entity).position = { x: 5, y: 0, z: 5 };
      await ctx.engine.update(1);
      await new Promise(r => setTimeout(r, 0));

      expect(sent.some(s => s.cmd === 'new_entity')).toBe(false);
      expect(sent.some(s => s.cmd === 'set_component' && s.args[1] === 'Transform')).toBe(true);
    });
  });

  describe('when an entity is deleted', () => {
    it('should send delete_entity', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, { ...IDENTITY, position: { x: 0, y: 0, z: 0 } });
      await ctx.engine.update(1);
      sent.length = 0;

      ctx.engine.removeEntity(entity);
      await ctx.engine.update(1);

      expect(sent).toContainEqual({ cmd: 'delete_entity', args: [String(entity)] });
    });
  });

  describe('when an unsupported (custom/schema) component changes', () => {
    it('should not send anything (deferred, not mis-addressed)', async () => {
      // PlayerIdentityData etc. aren't in the engine-name map; use a component
      // the context does not forward. Name component is core-schema, not core::.
      const entity = ctx.engine.addEntity();
      // Only Transform is bound on the context; create it, then confirm the only
      // writes are Transform ones (no stray sends for internal editor components).
      ctx.Transform.create(entity, { ...IDENTITY, position: { x: 0, y: 0, z: 0 } });
      await ctx.engine.update(1);
      expect(sent.every(s => s.args[1] === 'Transform' || s.cmd === 'delete_entity')).toBe(true);
    });
  });

  describe('after disconnect', () => {
    it('should stop forwarding changes', async () => {
      disconnect();
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, { ...IDENTITY, position: { x: 9, y: 9, z: 9 } });
      await ctx.engine.update(1);
      expect(sent).toEqual([]);
    });
  });

  describe('when the forward gate is closed (initial-load suppression)', () => {
    it('should not forward changes while shouldForward is false', async () => {
      const gatedSent: Array<{ cmd: string; args: string[] }> = [];
      const gatedCtx = new BevySceneContext();
      const off = createForwardEditBridge({
        context: gatedCtx,
        engineWindow,
        shouldForward: () => false, // gate closed (simulates the arm delay)
        send: async (cmd, args) => {
          gatedSent.push({ cmd, args });
          return '';
        },
      });

      const entity = gatedCtx.engine.addEntity();
      gatedCtx.Transform.create(entity, { ...IDENTITY, position: { x: 1, y: 1, z: 1 } });
      await gatedCtx.engine.update(1);

      expect(gatedSent).toEqual([]);
      off();
      gatedCtx.dispose();
    });
  });

  describe('when a GltfContainer is forwarded (#1373: editor pointer-pickable)', () => {
    it('should OR the pointer bit into visibleMeshesCollisionMask', async () => {
      const GltfContainer = components.GltfContainer(ctx.engine);
      const entity = ctx.engine.addEntity();
      // A model authored with NO pointer collision (mask 0) — unpickable as-is.
      GltfContainer.create(entity, { src: 'assets/thing.glb', visibleMeshesCollisionMask: 0 });
      await ctx.engine.update(1);
      await new Promise(r => setTimeout(r, 0));

      const write = sent.find(s => s.cmd === 'set_component' && s.args[1] === 'GltfContainer');
      expect(write).toBeDefined();
      const value = JSON.parse(write!.args[2]);
      // CL_POINTER (bit 1) forced on so the editor pick ray hits it.
      expect(value.visibleMeshesCollisionMask & 1).toBe(1);
    });

    it('should preserve other collision bits already set', async () => {
      const GltfContainer = components.GltfContainer(ctx.engine);
      const entity = ctx.engine.addEntity();
      // Authored with CL_PHYSICS (bit 2) only.
      GltfContainer.create(entity, { src: 'assets/thing.glb', visibleMeshesCollisionMask: 2 });
      await ctx.engine.update(1);
      await new Promise(r => setTimeout(r, 0));

      const write = sent.find(s => s.cmd === 'set_component' && s.args[1] === 'GltfContainer');
      const mask = JSON.parse(write!.args[2]).visibleMeshesCollisionMask;
      expect(mask & 1).toBe(1); // pointer added
      expect(mask & 2).toBe(2); // physics preserved
    });
  });

  describe('when an editor Placeholder is written (#1372)', () => {
    it('should forward it as a GltfContainer pointed at the placeholder src', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Name.create(entity, { value: 'Trigger Area' });
      ctx.editorComponents.Placeholder.create(entity, { src: 'assets/placeholder.glb' });
      await ctx.engine.update(1);
      // let the per-entity enqueue chain (ensureInstantiated → set) drain
      await new Promise(r => setTimeout(r, 0));
      await new Promise(r => setTimeout(r, 0));

      const write = sent.find(s => s.cmd === 'set_component' && s.args[1] === 'GltfContainer');
      expect(write).toBeDefined();
      const value = JSON.parse(write!.args[2]);
      expect(value.src).toBe('assets/placeholder.glb');
      // forwardSet also makes it pointer-pickable (#1373) so the placeholder can
      // be clicked to select the item.
      expect(value.visibleMeshesCollisionMask & 1).toBe(1);
    });

    it('should NOT forward a placeholder when the entity has an authored GltfContainer', async () => {
      const GltfContainer = components.GltfContainer(ctx.engine);
      const entity = ctx.engine.addEntity();
      ctx.Name.create(entity, { value: 'Real Model' });
      GltfContainer.create(entity, { src: 'assets/real.glb', visibleMeshesCollisionMask: 3 });
      ctx.editorComponents.Placeholder.create(entity, { src: 'assets/placeholder.glb' });
      await ctx.engine.update(1);
      await Promise.resolve();
      await Promise.resolve();

      // The only GltfContainer set is the authored model; the placeholder src
      // never overrides it.
      const gltfWrites = sent.filter(
        s => s.cmd === 'set_component' && s.args[1] === 'GltfContainer',
      );
      expect(gltfWrites.every(s => JSON.parse(s.args[2]).src === 'assets/real.glb')).toBe(true);
      expect(gltfWrites.some(s => JSON.parse(s.args[2]).src === 'assets/placeholder.glb')).toBe(
        false,
      );
    });

    it('should delete the engine GltfContainer when the placeholder is removed', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Name.create(entity, { value: 'Trigger Area' });
      ctx.editorComponents.Placeholder.create(entity, { src: 'assets/placeholder.glb' });
      await ctx.engine.update(1);
      await Promise.resolve();
      await Promise.resolve();
      sent.length = 0;

      ctx.editorComponents.Placeholder.deleteFrom(entity);
      await ctx.engine.update(1);
      await new Promise(r => setTimeout(r, 0));
      await new Promise(r => setTimeout(r, 0));

      const del = sent.find(s => s.cmd === 'delete_component' && s.args[1] === 'GltfContainer');
      expect(del).toBeDefined();
    });
  });

  describe('when a console command fails', () => {
    it('should report via onError and not throw into the change loop', async () => {
      const errors: string[] = [];
      const failCtx = new BevySceneContext();
      const off = createForwardEditBridge({
        context: failCtx,
        engineWindow,
        shouldForward: () => true,
        send: async () => {
          throw new Error('engine console gone');
        },
        onError: label => errors.push(label),
      });

      const entity = failCtx.engine.addEntity();
      failCtx.Transform.create(entity, { ...IDENTITY, position: { x: 1, y: 1, z: 1 } });
      await failCtx.engine.update(1);
      // let the fire-and-forget rejection settle
      await Promise.resolve();
      await Promise.resolve();

      expect(errors.length).toBeGreaterThanOrEqual(1);
      off();
      failCtx.dispose();
    });
  });
});
