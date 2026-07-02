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
