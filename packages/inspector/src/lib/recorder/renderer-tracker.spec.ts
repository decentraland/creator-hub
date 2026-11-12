import type { Entity } from '@dcl/ecs';

import type { RendererActivity } from '../renderer/types';
import { createInspectorEngine } from '../sdk/inspector-engine';
import { trackRenderer, type RendererTrackerOptions } from './renderer-tracker';
import type { RecordedEventInput, StopTracker } from './types';

type Listener<T> = (value: T) => void;

function createMockRenderer(describeEntity?: (entity: Entity) => Promise<string | null>) {
  let activityListener: Listener<RendererActivity> | null = null;
  let runListener: Listener<boolean> | null = null;
  let editingListener: Listener<boolean> | null = null;
  let running = false;
  let editing = true;
  const unsubscribes = {
    activity: vi.fn(() => {
      activityListener = null;
    }),
    run: vi.fn(),
    editing: vi.fn(),
    gizmos: vi.fn(),
  };
  const renderer = {
    activity: {
      track: vi.fn((cb: Listener<RendererActivity>) => {
        activityListener = cb;
        return unsubscribes.activity;
      }),
      ...(describeEntity && { describeEntity }),
    },
    sceneRun: {
      isRunning: () => running,
      setRunning: vi.fn(),
      reset: vi.fn(),
      onRunChange: vi.fn((cb: Listener<boolean>) => {
        runListener = cb;
        return unsubscribes.run;
      }),
    },
    interaction: {
      isEditingEnabled: () => editing,
      setEditingEnabled: vi.fn(),
      onEditingChange: vi.fn((cb: Listener<boolean>) => {
        editingListener = cb;
        return unsubscribes.editing;
      }),
    },
    gizmos: {
      isWorldAligned: () => false,
      onChange: vi.fn(() => unsubscribes.gizmos),
    },
  } as unknown as RendererTrackerOptions['renderer'];

  return {
    renderer,
    unsubscribes,
    report: (activity: RendererActivity) => activityListener?.(activity),
    setRunning(value: boolean) {
      running = value;
      runListener?.(value);
    },
    setEditing(value: boolean) {
      editing = value;
      editingListener?.(value);
    },
  };
}

describe('trackRenderer', () => {
  let ctx: ReturnType<typeof createInspectorEngine>;
  let mock: ReturnType<typeof createMockRenderer>;
  let emitted: RecordedEventInput[];
  let stop: StopTracker;
  let barrel: Entity;

  beforeEach(async () => {
    vi.useFakeTimers();
    ctx = createInspectorEngine();
    barrel = ctx.engine.addEntity();
    ctx.components.Name.create(barrel, { value: 'Barrel_3' });
    await ctx.engine.update(1);
    mock = createMockRenderer();
    emitted = [];
    stop = trackRenderer({
      engine: ctx.engine,
      renderer: mock.renderer,
      emit: event => emitted.push(event),
      now: () => Date.now(),
    });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  describe('when the pointer rests on an authored entity', () => {
    beforeEach(() => {
      mock.report({ kind: 'pointerTarget', entity: barrel, point: { x: 8, y: 1.04, z: 8 } });
      vi.advanceTimersByTime(200);
    });

    it('should name the entity and where the pointer hit it', () => {
      expect(emitted).toEqual([
        expect.objectContaining({
          kind: 'viewport-hover',
          area: 'Viewport',
          text: `Pointer over Barrel_3 (#${barrel}) in the viewport at (8, 1, 8)`,
          entity: { id: barrel, name: 'Barrel_3' },
        }),
      ]);
    });
  });

  describe('when the pointer only sweeps across an entity', () => {
    beforeEach(() => {
      mock.report({ kind: 'pointerTarget', entity: barrel });
      vi.advanceTimersByTime(50);
      mock.report({ kind: 'pointerTarget', entity: null });
      vi.advanceTimersByTime(200);
    });

    it('should only report where it came to rest', () => {
      expect(emitted.map(e => e.text)).toEqual(['Pointer over nothing in the viewport']);
    });
  });

  describe('when the pointer is over an entity the scene code created at runtime', () => {
    beforeEach(() => {
      mock.report({ kind: 'pointerTarget', entity: 1043 as Entity, meshName: 'Coin' });
      vi.advanceTimersByTime(200);
    });

    it('should say so and keep the mesh name as its only handle', () => {
      expect(emitted).toEqual([
        expect.objectContaining({
          text: 'Pointer over an entity created by the scene\'s code (#1043, mesh "Coin") in the viewport',
          entity: { id: 1043, name: 'Coin' },
        }),
      ]);
    });
  });

  describe('when the scene is playing', () => {
    beforeEach(() => {
      mock.setRunning(true);
      mock.report({ kind: 'sceneClick', entity: barrel, point: { x: 1, y: 2, z: 3 } });
    });

    it('should record the mode change and prefix the click', () => {
      expect(emitted.map(e => [e.kind, e.text])).toEqual([
        ['mode', 'Started playing the scene'],
        [
          'scene-click',
          `While playing: Clicked Barrel_3 (#${barrel}) in the running scene at (1, 2, 3)`,
        ],
      ]);
    });
  });

  describe('when viewport editing is turned off', () => {
    beforeEach(() => {
      mock.setEditing(false);
      mock.report({ kind: 'playerMove', position: { x: 12.34, y: 0, z: 8.06 } });
    });

    it('should record Interact mode and say the scene is paused', () => {
      expect(emitted.map(e => [e.kind, e.text])).toEqual([
        ['mode', 'Turned on Interact mode (viewport clicks reach the running scene)'],
        ['player', 'In Interact mode (scene paused): Player at (12.3, 0, 8.1)'],
      ]);
    });
  });

  describe('when the player moves in small, frequent steps', () => {
    beforeEach(() => {
      mock.report({ kind: 'playerMove', position: { x: 0, y: 0, z: 0 } });
      vi.advanceTimersByTime(300);
      mock.report({ kind: 'playerMove', position: { x: 3, y: 0, z: 0 } });
      vi.advanceTimersByTime(1_000);
      mock.report({ kind: 'playerMove', position: { x: 0.2, y: 0, z: 0 } });
      vi.advanceTimersByTime(1_000);
      mock.report({ kind: 'playerMove', position: { x: 6, y: 0, z: 0 } });
    });

    it('should throttle by time and distance', () => {
      expect(emitted.map(e => e.text)).toEqual(['Player at (0, 0, 0)', 'Player at (6, 0, 0)']);
    });
  });

  describe('when the tracker stops', () => {
    beforeEach(() => {
      stop();
    });

    it('should unsubscribe from every renderer source', () => {
      expect(mock.unsubscribes.activity).toHaveBeenCalledTimes(1);
      expect(mock.unsubscribes.run).toHaveBeenCalledTimes(1);
      expect(mock.unsubscribes.editing).toHaveBeenCalledTimes(1);
      expect(mock.unsubscribes.gizmos).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('when the renderer cannot report activity', () => {
    let bare: StopTracker;

    beforeEach(() => {
      bare = trackRenderer({
        engine: ctx.engine,
        renderer: {
          gizmos: { isWorldAligned: () => true, onChange: () => () => undefined },
        } as never,
        emit: event => emitted.push(event),
      });
    });

    afterEach(() => bare());

    it('should start without it', () => {
      expect(emitted).toEqual([]);
    });
  });

  describe('when the running scene can say what its own entities look like', () => {
    let described: ReturnType<typeof createMockRenderer>;
    let stopDescribed: StopTracker;

    beforeEach(() => {
      stop();
      emitted = [];
      described = createMockRenderer(async entity =>
        entity === 1043 ? 'a red box (clickable: "Grab")' : null,
      );
      stopDescribed = trackRenderer({
        engine: ctx.engine,
        renderer: described.renderer,
        emit: event => emitted.push(event),
        now: () => Date.now(),
      });
    });

    afterEach(() => stopDescribed());

    describe('and the pointer rests on one of them', () => {
      let restedAt: number;

      beforeEach(async () => {
        restedAt = Date.now();
        described.report({ kind: 'pointerTarget', entity: 1043 as Entity });
        await vi.advanceTimersByTimeAsync(200);
      });

      it('should describe it by its looks, stamped when the pointer came to rest', () => {
        expect(emitted).toEqual([
          expect.objectContaining({
            t: restedAt,
            kind: 'viewport-hover',
            text: 'Pointer over a red box (clickable: "Grab") created by the scene\'s code (#1043) in the viewport',
            entity: { id: 1043, name: 'red box' },
          }),
        ]);
      });
    });

    describe('and the scene cannot say', () => {
      beforeEach(async () => {
        described.report({ kind: 'sceneClick', entity: 2077 as Entity });
        await vi.advanceTimersByTimeAsync(0);
      });

      it('should fall back to the entity number', () => {
        expect(emitted.map(e => e.text)).toEqual([
          "Clicked an entity created by the scene's code (#2077) in the running scene",
        ]);
      });
    });

    describe('and an authored entity is pointed at', () => {
      beforeEach(() => {
        described.report({ kind: 'pointerTarget', entity: barrel });
        vi.advanceTimersByTime(200);
      });

      it('should use its editor name without asking the scene', () => {
        expect(emitted.map(e => e.entity)).toEqual([{ id: barrel, name: 'Barrel_3' }]);
      });
    });
  });

  describe('when the scene code makes things appear and disappear', () => {
    beforeEach(() => {
      mock.setRunning(true);
      mock.report({ kind: 'playerMove', position: { x: 16, y: 0, z: 5 } as never });
      emitted = [];
      mock.report({
        kind: 'sceneEntities',
        change: 'appeared',
        entity: 600 as Entity,
        count: 1,
        description: 'a large dark purple sphere (clickable: "Hit") with 6 attached parts',
        position: { x: 16, y: 2.6, z: 25 } as never,
        at: 12_345,
      });
      mock.report({
        kind: 'sceneEntities',
        change: 'appeared',
        entity: null,
        count: 3,
        description: 'a small red box',
      });
      mock.report({
        kind: 'sceneEntities',
        change: 'removed',
        entity: 131615 as Entity,
        count: 1,
        description: 'a red box',
      });
    });

    it('should record each change with where it happened, relative to the player', () => {
      expect(emitted).toEqual([
        {
          t: 12_345,
          kind: 'scene-appear',
          area: 'Viewport',
          text: 'While playing: A large dark purple sphere (clickable: "Hit") with 6 attached parts (#600) appeared at (16, 2.6, 25), 20 m from the player',
          entity: { id: 600, name: 'large dark purple sphere' },
        },
        {
          kind: 'scene-appear',
          area: 'Viewport',
          text: 'While playing: 3 entities appeared, each a small red box',
        },
        {
          kind: 'scene-remove',
          area: 'Viewport',
          text: 'While playing: A red box (#131615) disappeared',
          entity: { id: 131615, name: 'red box' },
        },
      ]);
    });
  });
});
