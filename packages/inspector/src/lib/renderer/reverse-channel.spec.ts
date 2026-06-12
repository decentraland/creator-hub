import mitt from 'mitt';
import type { Emitter } from 'mitt';

import type { SceneContext } from '../babylon/decentraland/SceneContext';
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

  describe('when disconnected', () => {
    it('should stop responding to events', () => {
      disconnect();
      events.emit('pick', { target: { kind: 'empty' }, modifiers: { multi: false } });
      expect(operations.updateSelectedEntity).not.toHaveBeenCalled();
    });
  });
});
