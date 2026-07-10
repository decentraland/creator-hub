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

  // GizmoType: FREE=0, POSITION=1, ROTATION=2, SCALE=3.
  describe('when an entity gains the Selection component', () => {
    it('should post set-selection with that entity, its world position, rotation, and gizmo mode', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 4, y: 1, z: 2 },
        rotation: { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 1 }); // POSITION → translate
      await ctx.engine.update(1);

      expect(posted).toContainEqual({
        to: 'scene',
        msg: {
          kind: 'set-selection',
          entity: entity as number,
          position: { x: 4, y: 1, z: 2 },
          rotation: { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
          mode: 'translate',
        },
      });
    });
  });

  describe('when the gizmo mode changes on the same selection', () => {
    it('should re-post with the new mode', async () => {
      const entity = ctx.engine.addEntity();
      ctx.editorComponents.Selection.create(entity, { gizmo: 1 }); // translate
      await ctx.engine.update(1);
      posted.length = 0;

      // User switches to rotate on the same entity via the Gizmos toolbar.
      ctx.editorComponents.Selection.getMutable(entity).gizmo = 2; // ROTATION
      await ctx.engine.update(1);

      expect(posted).toContainEqual({
        to: 'scene',
        msg: {
          kind: 'set-selection',
          entity: entity as number,
          position: null,
          rotation: null,
          mode: 'rotate',
        },
      });
    });
  });

  describe("when the selected entity's Transform changes", () => {
    it('should re-post with the new position and rotation', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 0, z: 1 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 3 }); // SCALE
      await ctx.engine.update(1);
      posted.length = 0;

      // A rotation edit lands while selected (panel edit, undo, gizmo commit) —
      // the scale gizmo must re-align, so the bridge re-posts the selection.
      const mutable = ctx.Transform.getMutable(entity);
      mutable.position = { x: 2, y: 0, z: 1 };
      mutable.rotation = { x: 0, y: 0.5, z: 0, w: 0.5 };
      await ctx.engine.update(1);

      expect(posted).toContainEqual({
        to: 'scene',
        msg: {
          kind: 'set-selection',
          entity: entity as number,
          position: { x: 2, y: 0, z: 1 },
          rotation: { x: 0, y: 0.5, z: 0, w: 0.5 },
          mode: 'scale',
        },
      });
    });
  });

  describe('when the selection is cleared', () => {
    it('should post set-selection null with free mode', async () => {
      const entity = ctx.engine.addEntity();
      ctx.editorComponents.Selection.create(entity, { gizmo: 1 });
      await ctx.engine.update(1);
      posted.length = 0;

      ctx.editorComponents.Selection.deleteFrom(entity);
      await ctx.engine.update(1);

      expect(posted).toContainEqual({
        to: 'scene',
        msg: { kind: 'set-selection', entity: null, position: null, rotation: null, mode: 'free' },
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
