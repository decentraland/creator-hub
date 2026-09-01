import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';

import { GizmoType } from '../../utils/gizmo';
import type { IRenderer, RendererEvents } from '../types';
import { createLoopback } from './loopback';

/**
 * A fully in-memory fake of the renderer-side IRenderer. Stands in for the real
 * BabylonRenderer (which needs a WebGL scene) so we can prove the loopback
 * transport + state mirror end-to-end. The host reads this fake's state into
 * snapshots; commands mutate it; events flow back through the fake's bus.
 */
function createFakeRenderer() {
  const events: Emitter<RendererEvents> = mitt<RendererEvents>();
  const calls: string[] = [];

  let speed = 4;
  let gizmoEnabled = false;
  let gizmoMode = GizmoType.POSITION;
  const positions = new Map<Entity, { x: number; y: number; z: number }>();
  let frameCb: (() => void) | null = null;
  let metricsCb: (() => void) | null = null;

  const renderer: IRenderer = {
    events,
    camera: {
      getSpeed: () => speed,
      reset: () => calls.push('camera.reset'),
      focusOnEntity: e => calls.push(`camera.focus:${e}`),
      setInvertRotation: () => calls.push('camera.invert'),
      zoom: step => calls.push(`camera.zoom:${step}`),
      getPose: () => ({
        position: { x: 1, y: 2, z: 3 },
        target: { x: 4, y: 5, z: 6 },
        fov: 0.8,
      }),
      setPose: () => calls.push('camera.setPose'),
      setControlEnabled: enabled => calls.push(`camera.control:${enabled}`),
    },
    gizmos: {
      isEnabled: () => gizmoEnabled,
      setEnabled: v => {
        gizmoEnabled = v;
        calls.push(`gizmos.setEnabled:${v}`);
      },
      setMode: m => {
        gizmoMode = m;
        calls.push(`gizmos.setMode:${m}`);
      },
      isWorldAligned: () => true,
      setWorldAligned: () => calls.push('gizmos.setWorldAligned'),
      isWorldAlignmentDisabled: () => false,
      onChange: () => () => {},
    },
    metrics: {
      getSceneMetrics: () => ({ triangles: 42, bodies: 3, materials: 2, textures: 1 }),
      getEntitiesOutsideLayout: () => [7 as Entity],
      onChange: cb => {
        metricsCb = cb;
        return () => {
          metricsCb = null;
        };
      },
    },
    viewport: {
      onFrame: cb => {
        frameCb = cb;
        return () => {
          frameCb = null;
        };
      },
      getGroundPlanes: () => [{ x: 8, z: 16 }],
      getEntityWorldPositions: entities => {
        const out = new Map<Entity, { x: number; y: number; z: number }>();
        for (const e of entities) {
          const p = positions.get(e);
          if (p) out.set(e, p);
        }
        return out;
      },
    },
    spawnPoints: {
      getSelectedIndex: () => null,
      getSelectedTarget: () => null,
      isHidden: () => false,
      select: i => calls.push(`spawn.select:${i}`),
      selectCameraTarget: i => calls.push(`spawn.cameraTarget:${i}`),
      setVisible: () => calls.push('spawn.setVisible'),
      onSelectionChange: () => () => {},
      onVisibilityChange: () => () => {},
    },
    debug: { isVisible: () => false, toggle: () => calls.push('debug.toggle') },
    setSelection: e => calls.push(`setSelection:${e.join(',')}`),
    getPointerWorldPoint: async () => ({ x: 9, y: 0, z: 9 }) as never,
    setGridVisible: v => calls.push(`grid:${v}`),
    dispose: () => calls.push('dispose'),
  };

  return {
    renderer,
    calls,
    setSpeed: (v: number) => (speed = v),
    setPosition: (e: Entity, p: { x: number; y: number; z: number }) => positions.set(e, p),
    triggerFrame: () => frameCb?.(),
    triggerMetricsChange: () => metricsCb?.(),
    get gizmoMode() {
      return gizmoMode;
    },
  };
}

describe('renderer loopback (out-of-process proof)', () => {
  let fake: ReturnType<typeof createFakeRenderer>;
  let loop: ReturnType<typeof createLoopback>;

  beforeEach(() => {
    fake = createFakeRenderer();
    loop = createLoopback(fake.renderer);
  });

  afterEach(() => {
    loop.dispose();
  });

  describe('synchronous mirror reads', () => {
    it('should answer camera/gizmo/metrics getters from the primed snapshot', () => {
      // createLoopback calls host.pushState() up front.
      expect(loop.remote.camera.getSpeed()).toBe(4);
      expect(loop.remote.camera.getPose()).toEqual({
        position: { x: 1, y: 2, z: 3 },
        target: { x: 4, y: 5, z: 6 },
        fov: 0.8,
      });
      expect(loop.remote.metrics.getSceneMetrics()).toEqual({
        triangles: 42,
        bodies: 3,
        materials: 2,
        textures: 1,
      });
      expect(loop.remote.metrics.getEntitiesOutsideLayout()).toEqual([7]);
      expect(loop.remote.viewport.getGroundPlanes()).toEqual([{ x: 8, z: 16 }]);
    });

    it('should refresh the mirror when the host re-pushes state', () => {
      fake.setSpeed(12);
      fake.triggerMetricsChange(); // host.pushState() fires on metrics change
      expect(loop.remote.camera.getSpeed()).toBe(12);
    });
  });

  describe('commands (inspector -> renderer)', () => {
    it('should reach the wrapped renderer through the wire', () => {
      loop.remote.camera.zoom(1);
      loop.remote.gizmos.setEnabled(true);
      loop.remote.gizmos.setMode(GizmoType.ROTATION);
      loop.remote.setGridVisible(false);
      loop.remote.setSelection([3 as Entity, 4 as Entity]);

      expect(fake.calls).toContain('camera.zoom:1');
      expect(fake.calls).toContain('gizmos.setEnabled:true');
      expect(fake.calls).toContain(`gizmos.setMode:${GizmoType.ROTATION}`);
      expect(fake.calls).toContain('grid:false');
      expect(fake.calls).toContain('setSelection:3,4');
      expect(fake.gizmoMode).toBe(GizmoType.ROTATION);
    });
  });

  describe('events (renderer -> inspector)', () => {
    it('should deliver pick events across the wire', () => {
      const received: unknown[] = [];
      loop.remote.events.on('pick', e => received.push(e));

      fake.renderer.events.emit('pick', {
        target: { kind: 'entity', entity: 11 as Entity },
        modifiers: { multi: true },
      });

      expect(received).toEqual([
        { target: { kind: 'entity', entity: 11 }, modifiers: { multi: true } },
      ]);
    });

    it('should deliver gizmoCommit transforms intact through JSON', () => {
      const received: RendererEvents['gizmoCommit'][] = [];
      loop.remote.events.on('gizmoCommit', e => received.push(e));

      fake.renderer.events.emit('gizmoCommit', {
        transforms: [{ entity: 2 as Entity, position: { x: 1.5, y: 2.5, z: 3.5 } as never }],
      });

      expect(received[0].transforms[0]).toEqual({
        entity: 2,
        position: { x: 1.5, y: 2.5, z: 3.5 },
      });
    });
  });

  describe('per-frame spatial path', () => {
    it('should mirror tracked entity positions each frame, rebuilt as a Map', () => {
      loop.host.setTrackedEntities([1 as Entity, 2 as Entity]);
      fake.setPosition(1 as Entity, { x: 10, y: 0, z: 20 });
      fake.setPosition(2 as Entity, { x: 30, y: 0, z: 40 });

      fake.triggerFrame();

      const positions = loop.remote.viewport.getEntityWorldPositions([1 as Entity, 2 as Entity]);
      expect(positions.get(1 as Entity)).toEqual({ x: 10, y: 0, z: 20 });
      expect(positions.get(2 as Entity)).toEqual({ x: 30, y: 0, z: 40 });
    });

    it('should fire onFrame subscribers on the inspector side', () => {
      const onFrame = vi.fn();
      loop.remote.viewport.onFrame(onFrame);
      fake.triggerFrame();
      expect(onFrame).toHaveBeenCalled();
    });
  });

  describe('async request path', () => {
    it('should round-trip getPointerWorldPoint through the wire', async () => {
      const point = await loop.remote.getPointerWorldPoint();
      expect(point).toEqual({ x: 9, y: 0, z: 9 });
    });
  });
});
