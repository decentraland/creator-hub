import type { Entity } from '@dcl/ecs';
import { Quaternion } from '@dcl/ecs-math';

import { createInspectorEngine } from '../sdk/inspector-engine';
import { GizmoType } from '../utils/gizmo';
import { trackEcs } from './ecs-tracker';
import type { RecordedEventInput, StopTracker } from './types';

type Context = ReturnType<typeof createInspectorEngine>;

describe('trackEcs', () => {
  let ctx: Context;
  let emitted: RecordedEventInput[];
  let stop: StopTracker;
  let barrel: Entity;

  async function tick() {
    await ctx.engine.update(1);
  }

  function texts() {
    return emitted.map(event => event.text);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    ctx = createInspectorEngine();
    const { engine, components } = ctx;
    barrel = engine.addEntity();
    components.Name.create(barrel, { value: 'Barrel_3' });
    components.Transform.create(barrel, { position: { x: 8, y: 0, z: 8 } });
    await tick();
    emitted = [];
    stop = trackEcs({
      engine,
      events: ctx.events,
      emit: event => emitted.push(event),
      now: () => Date.now(),
    });
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  describe('when the user selects an entity', () => {
    beforeEach(async () => {
      ctx.components.Selection.create(barrel, { gizmo: GizmoType.POSITION });
      await tick();
      await vi.advanceTimersByTimeAsync(100);
    });

    it('should emit the selection with the entity name and id', () => {
      expect(emitted).toEqual([
        expect.objectContaining({
          kind: 'select',
          text: `Selected Barrel_3 (#${barrel})`,
          entity: { id: barrel, name: 'Barrel_3' },
        }),
      ]);
    });

    describe('and then clears it', () => {
      beforeEach(async () => {
        emitted = [];
        ctx.components.Selection.deleteFrom(barrel);
        await tick();
        await vi.advanceTimersByTimeAsync(100);
      });

      it('should emit that the selection was cleared', () => {
        expect(texts()).toEqual(['Cleared the selection']);
      });
    });

    describe('and then switches the gizmo', () => {
      beforeEach(async () => {
        emitted = [];
        ctx.components.Selection.createOrReplace(barrel, { gizmo: GizmoType.ROTATION });
        await tick();
        await vi.advanceTimersByTimeAsync(100);
      });

      it('should emit the gizmo mode, not a new selection', () => {
        expect(emitted).toEqual([
          expect.objectContaining({ kind: 'mode', text: 'Switched the gizmo to Rotation' }),
        ]);
      });
    });
  });

  describe('when the user selects several entities', () => {
    let crate: Entity;

    beforeEach(async () => {
      crate = ctx.engine.addEntity();
      ctx.components.Name.create(crate, { value: 'Crate' });
      ctx.components.Transform.create(crate);
      await tick();
      await vi.advanceTimersByTimeAsync(100);
      emitted = [];
      ctx.components.Selection.create(barrel, { gizmo: 0 });
      ctx.components.Selection.create(crate, { gizmo: 0 });
      await tick();
      await vi.advanceTimersByTimeAsync(100);
    });

    it('should list them in one event', () => {
      expect(texts()).toEqual([`Selected 2 entities: Barrel_3 (#${barrel}), Crate (#${crate})`]);
    });
  });

  describe('when the user renames an entity, one keystroke at a time', () => {
    beforeEach(async () => {
      for (const name of ['B', 'Bo', 'Box']) {
        ctx.components.Name.createOrReplace(barrel, { value: name });
        await tick();
        await vi.advanceTimersByTimeAsync(100);
      }
      await vi.advanceTimersByTimeAsync(500);
    });

    it('should emit one rename from the old name to the final one', () => {
      expect(emitted).toEqual([
        expect.objectContaining({
          kind: 'entity',
          text: `Renamed "Barrel_3" to "Box" (#${barrel})`,
          entity: { id: barrel, name: 'Box' },
        }),
      ]);
    });
  });

  describe('when the user drags an entity', () => {
    beforeEach(async () => {
      for (const x of [9, 10, 11.256]) {
        ctx.components.Transform.getMutable(barrel).position.x = x;
        await tick();
        await vi.advanceTimersByTimeAsync(100);
      }
      ctx.components.Transform.getMutable(barrel).rotation = Quaternion.fromEulerDegrees(0, 90, 0);
      await tick();
      await vi.advanceTimersByTimeAsync(500);
    });

    it('should coalesce the moves into one compact Transform change', () => {
      expect(emitted).toEqual([
        expect.objectContaining({
          kind: 'component',
          text: `Changed Transform of Barrel_3 (#${barrel}): position (11.26, 0, 8), rotation (0°, 90°, 0°), scale (1, 1, 1)`,
          entity: { id: barrel, name: 'Barrel_3' },
        }),
      ]);
    });
  });

  describe('when a change keeps going past the longest coalescing window', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 25; i++) {
        ctx.components.Transform.getMutable(barrel).position.y = i;
        await tick();
        await vi.advanceTimersByTimeAsync(100);
      }
    });

    it('should report it once the window is exceeded, while it continues', () => {
      expect(texts()).toEqual([expect.stringContaining('position (8, 21, 8)')]);
    });
  });

  describe('when the user creates an entity', () => {
    let lamp: Entity;

    beforeEach(async () => {
      lamp = ctx.engine.addEntity();
      ctx.components.Name.create(lamp, { value: 'Lamp' });
      ctx.components.Transform.create(lamp);
      ctx.components.GltfContainer.create(lamp, { src: 'assets/lamp.glb' });
      await tick();
      await vi.advanceTimersByTimeAsync(600);
    });

    it('should emit one creation naming its components', () => {
      expect(texts()).toEqual([`Created Lamp (#${lamp}) with Transform, GltfContainer`]);
    });
  });

  describe('when the user adds and then removes a component', () => {
    beforeEach(async () => {
      ctx.components.MeshCollider.setBox(barrel);
      await tick();
      await vi.advanceTimersByTimeAsync(100);
      ctx.components.MeshCollider.deleteFrom(barrel);
      await tick();
      await vi.advanceTimersByTimeAsync(100);
    });

    it('should emit the addition and the removal', () => {
      expect(texts()).toEqual([
        `Added MeshCollider to Barrel_3 (#${barrel})`,
        `Removed MeshCollider from Barrel_3 (#${barrel})`,
      ]);
    });
  });

  describe('when the user deletes an entity, which removes each of its components', () => {
    beforeEach(async () => {
      ctx.components.Transform.deleteFrom(barrel);
      ctx.components.Name.deleteFrom(barrel);
      await tick();
      await vi.advanceTimersByTimeAsync(600);
    });

    it('should emit one deletion with the name it had', () => {
      expect(texts()).toEqual([`Deleted Barrel_3 (#${barrel})`]);
    });
  });

  describe('when the user hides an entity', () => {
    beforeEach(async () => {
      ctx.components.Hide.create(barrel, { value: true });
      await tick();
      await vi.advanceTimersByTimeAsync(100);
    });

    it('should say it was hidden rather than that a component was added', () => {
      expect(texts()).toEqual([`Hid Barrel_3 (#${barrel})`]);
    });
  });

  describe('when an editor-internal component changes', () => {
    beforeEach(async () => {
      ctx.components.Nodes.createOrReplace(ctx.engine.RootEntity, {
        value: [{ entity: ctx.engine.RootEntity, children: [barrel] }],
      });
      await tick();
      await vi.advanceTimersByTimeAsync(600);
    });

    it('should emit nothing', () => {
      expect(emitted).toEqual([]);
    });
  });

  describe('when the tracker stops with a change still coalescing', () => {
    beforeEach(async () => {
      ctx.components.Transform.getMutable(barrel).position.z = 2;
      await tick();
      stop();
    });

    it('should emit it right away', () => {
      expect(texts()).toEqual([
        `Changed Transform of Barrel_3 (#${barrel}): position (8, 0, 2), rotation (0°, 0°, 0°), scale (1, 1, 1)`,
      ]);
    });

    it('should not listen to later changes', async () => {
      emitted = [];
      ctx.components.Transform.getMutable(barrel).position.z = 3;
      await tick();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(emitted).toEqual([]);
    });
  });
});
