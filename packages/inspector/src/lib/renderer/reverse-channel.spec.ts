import mitt from 'mitt';
import type { Emitter } from 'mitt';
import { Quaternion, Vector3 } from '@dcl/ecs-math';

import type { SceneContext } from '../babylon/decentraland/SceneContext';
import { snapManager } from '../babylon/decentraland/snap-manager';
import { connectReverseChannel } from './reverse-channel';
import type { RendererEvents } from './types';

vi.mock('../sdk/nodes', () => ({
  getAncestors: vi.fn(() => new Set<number>()),
  isAncestor: vi.fn(() => false),
  mapNodes: vi.fn(() => [{ entity: 0, children: [], open: false }]),
}));

describe('connectReverseChannel', () => {
  let events: Emitter<RendererEvents>;
  let operations: {
    updateValue: ReturnType<typeof vi.fn>;
    updateSelectedEntity: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
  };
  let transformValue: Record<string, unknown> | null;
  let context: SceneContext;
  let disconnect: () => void;

  const ROOT = 0 as never;
  const PLAYER = 5 as never;

  beforeEach(() => {
    events = mitt<RendererEvents>();
    operations = {
      updateValue: vi.fn(),
      updateSelectedEntity: vi.fn(),
      dispatch: vi.fn().mockResolvedValue(undefined),
    };
    transformValue = { position: { x: 0, y: 0, z: 0 } };
    // The merge tests below assert pure composition; snapping (enabled by
    // default) is exercised by its own describe.
    snapManager.setEnabled(false);

    context = {
      rendererEvents: events,
      operations,
      engine: { RootEntity: ROOT, PlayerEntity: PLAYER },
      editorComponents: { Nodes: { componentId: 1 } },
      Transform: { componentId: 2, getOrNull: vi.fn(() => transformValue) },
    } as unknown as SceneContext;

    disconnect = connectReverseChannel(context);
  });

  afterEach(() => {
    disconnect();
    vi.clearAllMocks();
  });

  describe('when an entity is picked', () => {
    it('should expand ancestors, select the entity with the multi flag, and dispatch', () => {
      events.emit('pick', {
        target: { kind: 'entity', entity: 42 as never },
        modifiers: { multi: true },
      });

      // Nodes tree is rewritten (ancestor expansion)
      expect(operations.updateValue).toHaveBeenCalledWith(
        context.editorComponents.Nodes,
        ROOT,
        expect.objectContaining({ value: expect.any(Array) }),
      );
      expect(operations.updateSelectedEntity).toHaveBeenCalledWith(42, true);
      expect(operations.dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when empty space is picked', () => {
    it('should select the root entity (deselect) and dispatch', () => {
      events.emit('pick', { target: { kind: 'empty' }, modifiers: { multi: false } });

      expect(operations.updateSelectedEntity).toHaveBeenCalledWith(ROOT);
      expect(operations.dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a spawn point is picked', () => {
    describe('and it became selected', () => {
      it('should mirror the selection onto the Player entity', () => {
        events.emit('pick', {
          target: { kind: 'spawnPoint', selected: true },
          modifiers: { multi: false },
        });

        expect(operations.updateSelectedEntity).toHaveBeenCalledWith(PLAYER);
        expect(operations.dispatch).toHaveBeenCalledTimes(1);
      });
    });

    describe('and it was toggled off', () => {
      it('should mirror the deselection onto the Root entity', () => {
        events.emit('pick', {
          target: { kind: 'spawnPoint', selected: false },
          modifiers: { multi: false },
        });

        expect(operations.updateSelectedEntity).toHaveBeenCalledWith(ROOT);
      });
    });
  });

  describe('when a gizmo commit arrives', () => {
    it('should merge each transform onto the current value without dispatching', () => {
      events.emit('gizmoCommit', {
        transforms: [{ entity: 42 as never, position: { x: 1, y: 2, z: 3 } as never }],
      });

      expect(operations.updateValue).toHaveBeenCalledWith(
        context.Transform,
        42,
        expect.objectContaining({ position: { x: 1, y: 2, z: 3 } }),
      );
      // The batch is flushed by gizmoCommitEnd, not by each commit.
      expect(operations.dispatch).not.toHaveBeenCalled();
    });

    it('should skip entities that no longer have a Transform', () => {
      (context.Transform.getOrNull as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      events.emit('gizmoCommit', {
        transforms: [{ entity: 99 as never, position: { x: 1, y: 1, z: 1 } as never }],
      });

      expect(operations.updateValue).not.toHaveBeenCalled();
    });

    it('should COMPOSE a rotation delta onto the current rotation', () => {
      // Current: 90° about Y. World-frame delta: 90° about Y. Expected: 180°
      // about Y (new = delta ⊗ current).
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.fromEulerDegrees(0, 90, 0),
        scale: { x: 1, y: 1, z: 1 },
      };
      const delta = Quaternion.fromEulerDegrees(0, 90, 0);
      const expected = Quaternion.multiply(delta, transformValue.rotation);

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, rotation: delta as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      for (const k of ['x', 'y', 'z', 'w'] as const) {
        expect(written.rotation[k]).toBeCloseTo(expected[k], 5);
      }
      // Rotation-only commit leaves position/scale untouched.
      expect(written.position).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should apply the rotation delta in the WORLD frame (delta ⊗ current, not current ⊗ delta)', () => {
      // Current: 90° about Y (local X points along world -Z). A world-aligned
      // ring drag about world X must rotate about world X regardless of the
      // entity's orientation — only delta ⊗ current does that; the two orders
      // differ here (unlike the same-axis case above).
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.fromEulerDegrees(0, 90, 0),
        scale: { x: 1, y: 1, z: 1 },
      };
      const delta = Quaternion.fromEulerDegrees(90, 0, 0); // 90° about world X
      const expected = Quaternion.multiply(delta, transformValue.rotation);
      const wrongOrder = Quaternion.multiply(transformValue.rotation, delta);

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, rotation: delta as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      for (const k of ['x', 'y', 'z', 'w'] as const) {
        expect(written.rotation[k]).toBeCloseTo(expected[k], 5);
      }
      // Sanity: the two orders genuinely differ for this case.
      expect(Math.abs(Quaternion.dot(expected, wrongOrder))).toBeLessThan(0.999);
    });

    it('should MULTIPLY a scale factor onto the current scale', () => {
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 2, y: 3, z: 4 },
      };
      const factor = { x: 2, y: 2, z: 0.5 };

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, scale: factor as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(written.scale).toEqual(Vector3.multiply(transformValue.scale, factor));
    });

    it('should clamp a committed scale away from zero', () => {
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 1, y: 1, z: 1 },
      };

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, scale: { x: 0.001, y: 1, z: 1 } as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(written.scale.x).toBeCloseTo(0.01, 10);
      expect(written.scale.y).toBeCloseTo(1, 10);
      expect(written.scale.z).toBeCloseTo(1, 10);
    });

    it('should recover an entity whose scale is already zero', () => {
      // 0 × factor = 0 forever — the base is clamped to the minimum first, so an
      // outward drag stretches the entity back into shape.
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 0, y: 0, z: 0 },
      };

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, scale: { x: 50, y: 50, z: 50 } as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(written.scale.x).toBeCloseTo(0.5, 10);
      expect(written.scale.y).toBeCloseTo(0.5, 10);
      expect(written.scale.z).toBeCloseTo(0.5, 10);
    });
  });

  describe('when a live gizmo drag arrives (gizmoDrag)', () => {
    it('should emit merged previewTransforms WITHOUT writing the CRDT or dispatching', () => {
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 1, y: 1, z: 1 },
      };
      const previews: RendererEvents['previewTransforms'][] = [];
      events.on('previewTransforms', p => previews.push(p));

      const delta = Quaternion.fromEulerDegrees(0, 90, 0);
      events.emit('gizmoDrag', {
        transforms: [
          { entity: 7 as never, position: { x: 5, y: 0, z: 0 }, rotation: delta } as never,
        ],
      });

      // Merged, absolute values are emitted for the renderer to preview…
      expect(previews).toHaveLength(1);
      const t = previews[0].transforms[0];
      expect(t.entity).toBe(7);
      expect(t.position).toEqual({ x: 5, y: 0, z: 0 });
      const expected = Quaternion.multiply(delta, transformValue.rotation);
      for (const k of ['x', 'y', 'z', 'w'] as const) {
        expect(t.rotation[k]).toBeCloseTo(expected[k], 5);
      }
      // …but NOTHING is written to the CRDT and no dispatch happens (no undo entry).
      expect(operations.updateValue).not.toHaveBeenCalled();
      expect(operations.dispatch).not.toHaveBeenCalled();
    });

    it('should skip preview entities that no longer have a Transform', () => {
      (context.Transform.getOrNull as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
      const previews: RendererEvents['previewTransforms'][] = [];
      events.on('previewTransforms', p => previews.push(p));

      events.emit('gizmoDrag', {
        transforms: [{ entity: 99 as never, position: { x: 1, y: 1, z: 1 } } as never],
      });
      expect(previews).toEqual([]);
    });
  });

  describe('when snapping is enabled', () => {
    beforeEach(() => {
      snapManager.setEnabled(true);
      snapManager.setPositionSnap(0.25);
      snapManager.setRotationSnap(Math.PI / 2); // 90°
      snapManager.setScaleSnap(0.1);
    });

    afterEach(() => {
      snapManager.setEnabled(false);
    });

    it('should snap a committed position to the position step', () => {
      events.emit('gizmoCommit', {
        transforms: [{ entity: 42 as never, position: { x: 1.1, y: 2.04, z: 2.9 } as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(written.position).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should snap the composed rotation to the rotation step', () => {
      // Identity ⊕ 80° about Y, snapped to 90° steps → 90° about Y.
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 1, y: 1, z: 1 },
      };
      const delta = Quaternion.fromEulerDegrees(0, 80, 0);
      const expected = Quaternion.fromEulerDegrees(0, 90, 0);

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, rotation: delta as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      for (const k of ['x', 'y', 'z', 'w'] as const) {
        expect(written.rotation[k]).toBeCloseTo(expected[k], 5);
      }
    });

    it('should snap the multiplied scale to the scale step', () => {
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 1, y: 1, z: 1 },
      };

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, scale: { x: 1.07, y: 1, z: 1 } as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(written.scale.x).toBeCloseTo(1.1, 10);
      expect(written.scale.y).toBeCloseTo(1, 10);
      expect(written.scale.z).toBeCloseTo(1, 10);
    });

    it('should clamp a snapped-to-zero scale away from zero', () => {
      // 1 × 0.01 = 0.01, which the 0.1 snap step rounds to 0 — the final clamp
      // must keep it recoverable.
      transformValue = {
        position: { x: 0, y: 0, z: 0 },
        rotation: Quaternion.Identity(),
        scale: { x: 1, y: 1, z: 1 },
      };

      events.emit('gizmoCommit', {
        transforms: [{ entity: 7 as never, scale: { x: 0.01, y: 1, z: 1 } as never }],
      });

      const written = (operations.updateValue as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(written.scale.x).toBeCloseTo(0.01, 10);
      expect(written.scale.y).toBeCloseTo(1, 10);
    });
  });

  describe('when a gizmo drag ends', () => {
    it('should dispatch once to flush the batch', () => {
      events.emit('gizmoCommit', {
        transforms: [{ entity: 1 as never, position: { x: 1, y: 0, z: 0 } as never }],
      });
      events.emit('gizmoCommit', {
        transforms: [{ entity: 2 as never, position: { x: 2, y: 0, z: 0 } as never }],
      });
      events.emit('gizmoCommitEnd');

      // Two writes, a single flush — one undo step for the multi-entity drag.
      expect(operations.updateValue).toHaveBeenCalledTimes(2);
      expect(operations.dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a gizmoCommit is not followed by gizmoCommitEnd', () => {
    it('should flush the pending write on disconnect rather than strand it', () => {
      events.emit('gizmoCommit', {
        transforms: [{ entity: 1 as never, position: { x: 1, y: 0, z: 0 } as never }],
      });
      // No gizmoCommitEnd — the renderer dropped/never sent it.
      expect(operations.dispatch).not.toHaveBeenCalled();

      disconnect();

      expect(operations.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should flush the pending write before applying a subsequent pick', () => {
      events.emit('gizmoCommit', {
        transforms: [{ entity: 1 as never, position: { x: 1, y: 0, z: 0 } as never }],
      });
      events.emit('pick', { target: { kind: 'empty' }, modifiers: { multi: false } });

      // The pending gizmo write is flushed, then the pick's own dispatch runs.
      expect(operations.dispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('when gizmoCommitEnd fires with no pending commit', () => {
    it('should not dispatch', () => {
      events.emit('gizmoCommitEnd');
      expect(operations.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('when disconnected', () => {
    it('should stop responding to events', () => {
      disconnect();
      events.emit('pick', { target: { kind: 'empty' }, modifiers: { multi: false } });
      expect(operations.updateSelectedEntity).not.toHaveBeenCalled();
    });
  });
});
