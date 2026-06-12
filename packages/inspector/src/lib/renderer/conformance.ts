import type { IEngine } from '@dcl/ecs';

import type { IRenderer } from './types';

/**
 * Conformance test kit for renderer authors.
 *
 * Verifies an {@link IRenderer} satisfies the contract's observable behavior. It
 * exercises the boundary only — it never looks inside your scene graph — so it
 * works for any engine.
 *
 *   import { describe, it, beforeEach, afterEach, expect } from 'vitest';
 *   import { createRendererConformanceSuite } from '@dcl/inspector';
 *
 *   createRendererConformanceSuite({
 *     harness: { describe, it, beforeEach, afterEach, expect },
 *     setup: () => {
 *       const r = buildMyRenderer();
 *       return { renderer: r, engine: r.engine, dispose: () => r.dispose() };
 *     },
 *   });
 *
 * The test harness is **injected** rather than assumed-global, so the kit works
 * under any runner (vitest, jest, node:test wrappers, …). It does NOT assert
 * pixels — it can't see your framebuffer. It asserts the contract: shape,
 * sync-read coherence, subscribe/unsubscribe, graceful degradation, teardown.
 */

export interface RendererConformanceSetup {
  /** The renderer under test. */
  renderer: IRenderer;
  /** Its `@dcl/ecs` engine (so the suite can create entities + drive changes). */
  engine: IEngine;
  /** Tear it down after each case. */
  dispose(): void;
}

/**
 * The minimal slice of a test framework the kit uses. Pass your runner's
 * primitives (e.g. vitest's `{ describe, it, beforeEach, afterEach, expect }`).
 * `expect` only needs the matchers below.
 */
export interface ConformanceHarness {
  describe(name: string, fn: () => void): void;
  it(name: string, fn: () => void | Promise<void>): void;
  beforeEach(fn: () => void | Promise<void>): void;
  afterEach(fn: () => void | Promise<void>): void;
  expect(actual: unknown): ConformanceMatchers;
}

export interface ConformanceMatchers {
  toBe(expected: unknown): void;
  toBeDefined(): void;
  toBeCloseTo(expected: number, numDigits?: number): void;
  toBeGreaterThanOrEqual(n: number): void;
}

export interface RendererConformanceOptions {
  /** The test framework primitives (injected, not assumed-global). */
  harness: ConformanceHarness;
  /** Build a fresh renderer (+ engine) for each test case. */
  setup: () => RendererConformanceSetup | Promise<RendererConformanceSetup>;
  /**
   * Skip cases for capabilities you haven't implemented yet (the contract allows
   * graceful no-ops). e.g. `{ gizmos: true }` to skip the gizmo checks.
   */
  skip?: Partial<Record<'gizmos' | 'metrics', boolean>>;
}

const isFn = (v: unknown): boolean => typeof v === 'function';

export function createRendererConformanceSuite(options: RendererConformanceOptions): void {
  const { harness, setup, skip = {} } = options;
  const { describe, it, beforeEach, afterEach, expect } = harness;

  describe('IRenderer conformance', () => {
    let renderer: IRenderer;
    let engine: IEngine;
    let teardown: () => void;

    beforeEach(async () => {
      const s = await setup();
      renderer = s.renderer;
      engine = s.engine;
      let done = false;
      teardown = () => {
        if (done) return;
        done = true;
        s.dispose();
      };
    });

    afterEach(() => teardown());

    describe('shape', () => {
      it('exposes the required sub-interfaces and methods', () => {
        expect(renderer.events).toBeDefined();
        expect(renderer.camera).toBeDefined();
        expect(renderer.gizmos).toBeDefined();
        expect(renderer.metrics).toBeDefined();
        expect(renderer.viewport).toBeDefined();
        expect(renderer.spawnPoints).toBeDefined();
        expect(isFn(renderer.setSelection)).toBe(true);
        expect(isFn(renderer.getPointerWorldPoint)).toBe(true);
        expect(isFn(renderer.getEntityAnimations)).toBe(true);
        expect(isFn(renderer.setGridVisible)).toBe(true);
        expect(isFn(renderer.dispose)).toBe(true);
      });
    });

    describe('camera', () => {
      it('returns a numeric pose, fov and speed', () => {
        const pose = renderer.camera.getPose();
        expect(typeof pose.position.x).toBe('number');
        expect(typeof pose.target.z).toBe('number');
        expect(typeof pose.fov).toBe('number');
        expect(typeof renderer.camera.getSpeed()).toBe('number');
      });

      it('reflects a set pose in the reported position', () => {
        renderer.camera.setPose({ x: 5, y: 6, z: 7 }, { x: 0, y: 0, z: 0 });
        const { position } = renderer.camera.getPose();
        // The contract requires setPose to take effect on the reported pose.
        expect(position.x).toBeCloseTo(5, 3);
        expect(position.y).toBeCloseTo(6, 3);
        expect(position.z).toBeCloseTo(7, 3);
      });
    });

    describe('viewport', () => {
      it('returns a Map from getEntityWorldPositions', () => {
        expect(renderer.viewport.getEntityWorldPositions([]) instanceof Map).toBe(true);
      });

      it('onFrame returns a working unsubscribe', () => {
        const off = renderer.viewport.onFrame(() => {});
        expect(isFn(off)).toBe(true);
        off(); // must not throw
      });
    });

    describe('forward channel (ECS → scene)', () => {
      it('ingests an engine tick without throwing', async () => {
        // The contract doesn't expose the scene graph, so the kit only asserts
        // the renderer ingests engine changes cleanly. Authors should add their
        // own scene-graph assertions (see ThreeSceneContext.spec.ts) for full
        // forward-path coverage — a green run here is necessary, not sufficient.
        engine.addEntity();
        await engine.update(1);
        // reaching here = no throw
        expect(true).toBe(true);
      });
    });

    describe('reverse channel', () => {
      it('accepts subscribe and unsubscribe without throwing', () => {
        const handler = () => {};
        renderer.events.on('pick', handler);
        renderer.events.off('pick', handler);
        expect(true).toBe(true);
      });
    });

    if (!skip.metrics) {
      describe('metrics', () => {
        it('reports numeric scene metrics', () => {
          const m = renderer.metrics.getSceneMetrics();
          expect(typeof m.triangles).toBe('number');
          expect(typeof m.bodies).toBe('number');
          expect(m.triangles).toBeGreaterThanOrEqual(0);
        });
      });
    }

    if (!skip.gizmos) {
      describe('gizmos', () => {
        it('reports a boolean alignment state and accepts setEnabled', () => {
          expect(typeof renderer.gizmos.isWorldAligned()).toBe('boolean');
          renderer.gizmos.setEnabled(true); // must not throw
          expect(true).toBe(true);
        });
      });
    }

    describe('teardown', () => {
      it('disposes without throwing', () => {
        renderer.dispose();
        expect(true).toBe(true);
      });
    });
  });
}
