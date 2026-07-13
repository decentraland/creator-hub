import { BevySceneContext } from './BevySceneContext';
import { createSelectionBridge } from './selection-bridge';

/**
 * The selection bridge posts the inspector's current selection to the agent over
 * the bus (`set-selection`) so the gizmo tracks it. Every selected entity's world
 * pose is sent as an `entities` array (the agent anchors the gizmo at their
 * centroid); the mode/align/snap ride alongside. Driven with a real
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

  // The last set-selection message posted (the bridge dedupes, so the most recent
  // post reflects the current state).
  const lastSelection = () => {
    const envelopes = posted.filter(
      (m): m is { to: string; msg: { kind: string } } =>
        !!m &&
        typeof m === 'object' &&
        (m as { msg?: { kind?: string } }).msg?.kind === 'set-selection',
    );
    return envelopes.at(-1)?.msg as
      | {
          kind: string;
          entities: { entity: number; position: unknown; rotation: unknown }[];
          alignToWorld: boolean;
          snap: unknown;
          mode: string;
        }
      | undefined;
  };

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

      expect(lastSelection()).toEqual({
        kind: 'set-selection',
        entities: [
          {
            entity: entity as number,
            position: { x: 4, y: 1, z: 2 },
            rotation: { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
          },
        ],
        alignToWorld: true,
        snap: null,
        mode: 'translate',
      });
    });
  });

  describe('when multiple entities are selected', () => {
    it('should post every selected entity with its world pose', async () => {
      const a = ctx.engine.addEntity();
      ctx.Transform.create(a, {
        ...IDENTITY,
        position: { x: 0, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      const b = ctx.engine.addEntity();
      ctx.Transform.create(b, {
        ...IDENTITY,
        position: { x: 4, y: 0, z: 0 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(a, { gizmo: 1 });
      ctx.editorComponents.Selection.create(b, { gizmo: 1 });
      await ctx.engine.update(1);

      const sel = lastSelection();
      expect(sel?.entities).toContainEqual({
        entity: a as number,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      });
      expect(sel?.entities).toContainEqual({
        entity: b as number,
        position: { x: 4, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      });
      expect(sel?.entities).toHaveLength(2);
      expect(sel?.mode).toBe('translate');
    });
  });

  describe('when the gizmo mode changes on the same selection', () => {
    it('should re-post with the new mode', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 0, z: 1 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 1 }); // translate
      await ctx.engine.update(1);
      posted.length = 0;

      // User switches to rotate on the same entity via the Gizmos toolbar.
      ctx.editorComponents.Selection.getMutable(entity).gizmo = 2; // ROTATION
      await ctx.engine.update(1);

      expect(lastSelection()?.mode).toBe('rotate');
      expect(lastSelection()?.entities).toHaveLength(1);
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

      expect(lastSelection()).toEqual({
        kind: 'set-selection',
        entities: [
          {
            entity: entity as number,
            position: { x: 2, y: 0, z: 1 },
            rotation: { x: 0, y: 0.5, z: 0, w: 0.5 },
          },
        ],
        alignToWorld: true,
        snap: null,
        mode: 'scale',
      });
    });
  });

  describe('when the "align to world" setting toggles', () => {
    it('should re-post the current selection with the new alignment', async () => {
      // A dedicated bridge wired with a fake gizmos handle (the renderer's
      // world-alignment state + change subscription).
      disconnect();
      posted.length = 0;
      let worldAligned = true;
      const gizmoHandlers = new Set<() => void>();
      disconnect = createSelectionBridge({
        context: ctx,
        gizmos: {
          isWorldAligned: () => worldAligned,
          onChange: cb => {
            gizmoHandlers.add(cb);
            return () => gizmoHandlers.delete(cb);
          },
        },
        channel: { postMessage: m => posted.push(m), close() {} },
      });

      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 0, z: 1 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 1 }); // translate
      await ctx.engine.update(1);
      posted.length = 0;

      // The user unchecks "align to world" in the Gizmos toolbar.
      worldAligned = false;
      for (const h of [...gizmoHandlers]) h();

      expect(lastSelection()?.alignToWorld).toBe(false);
      expect(lastSelection()?.mode).toBe('translate');
    });
  });

  describe('when the snap settings change', () => {
    it('should re-post the current selection with the new snap values', async () => {
      // A dedicated bridge wired with a fake snap handle (the editor's snap
      // settings + change subscription).
      disconnect();
      posted.length = 0;
      let snap: { position: number; rotation: number; scale: number } | null = null;
      const snapHandlers = new Set<() => void>();
      disconnect = createSelectionBridge({
        context: ctx,
        snap: {
          getSnap: () => snap,
          onChange: cb => {
            snapHandlers.add(cb);
            return () => snapHandlers.delete(cb);
          },
        },
        channel: { postMessage: m => posted.push(m), close() {} },
      });

      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 0, z: 1 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 2 }); // rotate
      await ctx.engine.update(1);
      posted.length = 0;

      // The user enables snapping / edits the Snap panel values.
      snap = { position: 0.25, rotation: Math.PI / 2, scale: 0.1 };
      for (const h of [...snapHandlers]) h();

      expect(lastSelection()?.snap).toEqual({ position: 0.25, rotation: Math.PI / 2, scale: 0.1 });
      expect(lastSelection()?.mode).toBe('rotate');
    });
  });

  describe('when the selection is cleared', () => {
    it('should post set-selection with an empty entities array and free mode', async () => {
      const entity = ctx.engine.addEntity();
      ctx.Transform.create(entity, {
        ...IDENTITY,
        position: { x: 1, y: 0, z: 1 },
        parent: ctx.engine.RootEntity,
      });
      ctx.editorComponents.Selection.create(entity, { gizmo: 1 });
      await ctx.engine.update(1);
      posted.length = 0;

      ctx.editorComponents.Selection.deleteFrom(entity);
      await ctx.engine.update(1);

      expect(lastSelection()).toEqual({
        kind: 'set-selection',
        entities: [],
        alignToWorld: true,
        snap: null,
        mode: 'free',
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
