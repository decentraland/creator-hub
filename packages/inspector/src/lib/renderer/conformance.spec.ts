import mitt from 'mitt';
import type { Emitter } from 'mitt';
import { Engine } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';

import type { IRenderer, RendererEvents } from './types';
import { createRendererConformanceSuite } from './conformance';

/**
 * Self-test: a minimal, fully-conformant in-memory IRenderer run through the
 * conformance kit. This proves the kit passes a correct implementation (and
 * would fail a broken one), and doubles as the smallest possible reference for
 * what "satisfying the contract" looks like — no WebGL required.
 */
function buildConformantRenderer() {
  const engine = Engine();
  const events: Emitter<RendererEvents> = mitt<RendererEvents>();
  const speed = 4;
  let pose = {
    position: DclVector3.create(8, 12, 24),
    target: DclVector3.create(8, 0, 8),
    fov: 1,
  };
  const positions = new Map<Entity, ReturnType<typeof DclVector3.create>>();

  const renderer: IRenderer = {
    events,
    camera: {
      getSpeed: () => speed,
      reset: () => {
        pose = {
          position: DclVector3.create(8, 12, 24),
          target: DclVector3.create(8, 0, 8),
          fov: 1,
        };
      },
      focusOnEntity: () => {},
      setInvertRotation: () => {},
      zoom: () => {},
      getPose: () => pose,
      setPose: (position, target) => {
        pose = { position, target, fov: pose.fov };
      },
      setControlEnabled: () => {},
    },
    gizmos: {
      isEnabled: () => false,
      setEnabled: () => {},
      setMode: () => {},
      isWorldAligned: () => true,
      setWorldAligned: () => {},
      isWorldAlignmentDisabled: () => false,
      onChange: () => () => {},
    },
    metrics: {
      getSceneMetrics: () => ({ triangles: 0, bodies: 0, materials: 0, textures: 0 }),
      getEntitiesOutsideLayout: () => [],
      onChange: () => () => {},
    },
    viewport: {
      onFrame: () => () => {},
      getGroundPlanes: () => [],
      getEntityWorldPositions: ids => {
        const out = new Map<Entity, ReturnType<typeof DclVector3.create>>();
        for (const id of ids) {
          const p = positions.get(id);
          if (p) out.set(id, p);
        }
        return out;
      },
    },
    spawnPoints: {
      getSelectedIndex: () => null,
      getSelectedTarget: () => null,
      isHidden: () => false,
      select: () => {},
      selectCameraTarget: () => {},
      setVisible: () => {},
      onSelectionChange: () => () => {},
      onVisibilityChange: () => () => {},
      attachGizmo: () => {},
      detachGizmo: () => {},
      setPosition: () => {},
    },
    setSelection: () => {},
    getPointerWorldPoint: async () => null,
    getEntityAnimations: async () => [],
    setGridVisible: () => {},
    dispose: () => {
      events.all.clear();
    },
  };

  return { renderer, engine, dispose: () => renderer.dispose() };
}

createRendererConformanceSuite({
  // The kit takes the test harness by injection; here we hand it vitest's
  // globals (proving the kit is framework-agnostic, not vitest-coupled).
  harness: { describe, it, beforeEach, afterEach, expect },
  setup: buildConformantRenderer,
});
