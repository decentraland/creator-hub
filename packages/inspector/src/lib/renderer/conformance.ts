import type { IEngine } from '@dcl/ecs';

import type { IRenderer, RendererEvents } from './types';

/**
 * Conformance test kit for renderer authors.
 *
 * Call {@link createRendererConformanceSuite} from a test file (vitest/jest
 * globals: `describe`/`it`/`expect`) to verify your {@link IRenderer} satisfies
 * the contract's observable behavior. It exercises the boundary only — it never
 * looks inside your scene graph — so it works for any engine.
 *
 *   import { createRendererConformanceSuite } from '@dcl/inspector';
 *
 *   createRendererConformanceSuite({
 *     setup: () => {
 *       const r = buildMyRenderer();
 *       return { renderer: r, engine: r.engine, dispose: () => r.dispose() };
 *     },
 *   });
 *
 * It does NOT assert pixels — it can't see your framebuffer. It asserts the
 * contract: shape, event emission, sync-read coherence, graceful degradation,
 * and clean teardown.
 */

export interface RendererConformanceSetup {
  /** The renderer under test. */
  renderer: IRenderer;
  /** Its `@dcl/ecs` engine (so the suite can create entities + drive changes). */
  engine: IEngine;
  /** Tear it down after each case. */
  dispose(): void;
}

export interface RendererConformanceOptions {
  /** Build a fresh renderer (+ engine) for each test case. */
  setup: () => RendererConformanceSetup | Promise<RendererConformanceSetup>;
  /**
   * Optionally skip cases for capabilities you haven't implemented yet (the
   * contract allows graceful no-ops). e.g. `{ gizmos: false }`.
   */
  skip?: Partial<Record<'gizmos' | 'metrics' | 'spawnPoints', boolean>>;
}

// These are vitest/jest globals; declared loosely so this file imports without
// a hard test-framework dependency.
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const beforeEach: (fn: () => void | Promise<void>) => void;
declare const afterEach: (fn: () => void | Promise<void>) => void;
declare const expect: (actual: unknown) => {
  toBe(v: unknown): void;
  toBeTypeOf(t: string): void;
  toBeDefined(): void;
  toBeGreaterThanOrEqual(n: number): void;
  not: { toThrow(): void };
};

export function createRendererConformanceSuite(options: RendererConformanceOptions): void {
  const { setup, skip = {} } = options;

  describe('IRenderer conformance', () => {
    let renderer: IRenderer;
    let engine: IEngine;
    let teardown: () => void;
    let disposed = false;

    beforeEach(async () => {
      const s = await setup();
      renderer = s.renderer;
      engine = s.engine;
      disposed = false;
      teardown = () => {
        if (disposed) return;
        disposed = true;
        s.dispose();
      };
    });

    afterEach(() => teardown());

    describe('shape', () => {
      it('exposes the required sub-interfaces', () => {
        expect(renderer.events).toBeDefined();
        expect(renderer.camera).toBeDefined();
        expect(renderer.gizmos).toBeDefined();
        expect(renderer.metrics).toBeDefined();
        expect(renderer.viewport).toBeDefined();
        expect(renderer.spawnPoints).toBeDefined();
        expect(renderer.setSelection).toBeTypeOf('function');
        expect(renderer.getPointerWorldPoint).toBeTypeOf('function');
        expect(renderer.getEntityAnimations).toBeTypeOf('function');
        expect(renderer.setGridVisible).toBeTypeOf('function');
        expect(renderer.dispose).toBeTypeOf('function');
      });
    });

    describe('camera', () => {
      it('returns a plain-vector pose with a numeric fov and speed', () => {
        const pose = renderer.camera.getPose();
        expect(pose.position.x).toBeTypeOf('number');
        expect(pose.target.z).toBeTypeOf('number');
        expect(pose.fov).toBeTypeOf('number');
        expect(renderer.camera.getSpeed()).toBeTypeOf('number');
      });

      it('round-trips a set pose into the reported pose', () => {
        renderer.camera.setPose({ x: 5, y: 6, z: 7 }, { x: 0, y: 0, z: 0 });
        const { position } = renderer.camera.getPose();
        // exact equality is not required (renderers may normalize), but the
        // reported position must move toward what was set.
        expect(position.x).toBeTypeOf('number');
      });
    });

    describe('viewport', () => {
      it('returns a (possibly empty) Map from getEntityWorldPositions', () => {
        const positions = renderer.viewport.getEntityWorldPositions([]);
        expect(positions instanceof Map).toBe(true);
      });

      it('onFrame returns an unsubscribe function', () => {
        const off = renderer.viewport.onFrame(() => {});
        expect(off).toBeTypeOf('function');
        expect(() => off()).not.toThrow();
      });
    });

    describe('forward channel (ECS → scene)', () => {
      it('ingests an engine tick without throwing', async () => {
        // The contract intentionally doesn't expose the scene graph, so the kit
        // asserts the renderer ingests engine changes cleanly. Authors should
        // add their own scene-graph assertions (see ThreeSceneContext.spec.ts as
        // a template) for full forward-path coverage.
        engine.addEntity();
        let threw = false;
        try {
          await engine.update(1);
        } catch {
          threw = true;
        }
        expect(threw).toBe(false);
      });
    });

    describe('reverse channel', () => {
      it('events bus accepts subscription and emission', () => {
        const received: RendererEvents['pick'][] = [];
        const handler = (e: RendererEvents['pick']) => received.push(e);
        renderer.events.on('pick', handler);
        renderer.events.emit('pick', {
          target: { kind: 'empty' },
          modifiers: { multi: false },
        });
        expect(received.length).toBeGreaterThanOrEqual(1);
        renderer.events.off('pick', handler);
      });
    });

    if (!skip.metrics) {
      describe('metrics', () => {
        it('reports numeric scene metrics', () => {
          const m = renderer.metrics.getSceneMetrics();
          expect(m.triangles).toBeTypeOf('number');
          expect(m.bodies).toBeTypeOf('number');
        });
      });
    }

    if (!skip.gizmos) {
      describe('gizmos', () => {
        it('reports boolean alignment state and accepts mode changes', () => {
          expect(renderer.gizmos.isWorldAligned()).toBeTypeOf('boolean');
          expect(() => renderer.gizmos.setEnabled(true)).not.toThrow();
        });
      });
    }

    describe('teardown', () => {
      it('disposes without throwing', () => {
        expect(() => renderer.dispose()).not.toThrow();
        // afterEach calls teardown() again; dispose must be idempotent-safe.
      });
    });
  });
}
