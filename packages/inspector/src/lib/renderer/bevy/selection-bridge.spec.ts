import { BevySceneContext } from './BevySceneContext';
import { createSelectionBridge } from './selection-bridge';

/**
 * The selection bridge posts the inspector's current selection to the agent over
 * the bus (`set-selection`) so the gizmo tracks it. Driven with a real
 * BevySceneContext (its engine carries the Selection editor component) + a fake
 * channel recorder.
 */
describe('createSelectionBridge', () => {
  let ctx: BevySceneContext;
  let posted: unknown[];
  let disconnect: () => void;

  beforeEach(() => {
    ctx = new BevySceneContext();
    posted = [];
    disconnect = createSelectionBridge({
      context: ctx,
      channel: { postMessage: m => posted.push(m), close() {} },
    });
  });

  afterEach(() => {
    disconnect();
    ctx.dispose();
  });

  const IDENTITY = { rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } };

  describe('when an entity gains the Selection component', () => {
    it('should post set-selection with that entity and its world position', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 4, y: 1, z: 2 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 0 });
      await ctx.engine.update(1);

      expect(posted).toContainEqual({
        to: 'scene',
        msg: { kind: 'set-selection', entity: entity as number, position: { x: 4, y: 1, z: 2 } },
      });
    });
  });

  describe('when the selection is cleared', () => {
    it('should post set-selection null', async () => {
      const entity = ctx.engine.addEntity();
      ctx.editorComponents.Selection.create(entity, { gizmo: 0 });
      await ctx.engine.update(1);
      posted.length = 0;

      ctx.editorComponents.Selection.deleteFrom(entity);
      await ctx.engine.update(1);

      expect(posted).toContainEqual({
        to: 'scene',
        msg: { kind: 'set-selection', entity: null, position: null },
      });
    });
  });

  describe('after disconnect', () => {
    it('should stop posting', async () => {
      disconnect();
      const entity = ctx.engine.addEntity();
      ctx.editorComponents.Selection.create(entity, { gizmo: 0 });
      await ctx.engine.update(1);
      expect(posted).toEqual([]);
    });
  });
});
