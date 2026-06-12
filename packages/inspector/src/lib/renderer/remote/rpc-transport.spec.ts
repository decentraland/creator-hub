import mitt from 'mitt';
import type { Emitter } from 'mitt';
import { InMemoryTransport } from '@dcl/mini-rpc';
import type { Entity } from '@dcl/ecs';

import { GizmoType } from '../../utils/gizmo';
import type { IRenderer, RendererEvents } from '../types';
import { RendererHost } from './host';
import { RemoteRenderer } from './RemoteRenderer';
import { createRpcRendererTransport, serveRendererHost } from './rpc-transport';

/** Minimal in-memory renderer-side IRenderer for the proof. */
function createFakeRenderer() {
  const events: Emitter<RendererEvents> = mitt<RendererEvents>();
  const calls: string[] = [];
  let speed = 4;

  const renderer: IRenderer = {
    events,
    camera: {
      getSpeed: () => speed,
      reset: () => calls.push('camera.reset'),
      focusOnEntity: e => calls.push(`camera.focus:${e}`),
      setInvertRotation: () => {},
      zoom: step => calls.push(`camera.zoom:${step}`),
      getPose: () => ({ position: { x: 1, y: 2, z: 3 }, target: { x: 4, y: 5, z: 6 }, fov: 0.8 }),
      setPose: () => {},
      setControlEnabled: () => {},
    },
    gizmos: {
      isEnabled: () => false,
      setEnabled: v => calls.push(`gizmos.setEnabled:${v}`),
      setMode: m => calls.push(`gizmos.setMode:${m}`),
      isWorldAligned: () => true,
      setWorldAligned: () => {},
      isWorldAlignmentDisabled: () => false,
      onChange: () => () => {},
    },
    metrics: {
      getSceneMetrics: () => ({ triangles: 42, bodies: 3, materials: 2, textures: 1 }),
      getEntitiesOutsideLayout: () => [],
      onChange: () => () => {},
    },
    viewport: {
      onFrame: () => () => {},
      getGroundPlanes: () => [{ x: 8, z: 16 }],
      getEntityWorldPositions: () => new Map(),
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
    },
    debug: { isVisible: () => false, toggle: () => calls.push('debug.toggle') },
    setSelection: () => {},
    getPointerWorldPoint: async () => ({ x: 9, y: 0, z: 9 }) as never,
    setGridVisible: () => {},
    dispose: () => {},
  };

  return { renderer, calls, setSpeed: (v: number) => (speed = v) };
}

/** Let queued microtasks (RPC message delivery) settle. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('renderer RPC transport (cross-context proof)', () => {
  let fake: ReturnType<typeof createFakeRenderer>;
  let inspectorSide: InMemoryTransport;
  let rendererSide: InMemoryTransport;
  let remote: RemoteRenderer;
  let server: { host: RendererHost; dispose(): void };

  beforeEach(() => {
    fake = createFakeRenderer();

    // Two endpoints, connected — simulating two postMessage windows.
    inspectorSide = new InMemoryTransport();
    rendererSide = new InMemoryTransport();
    inspectorSide.connect(rendererSide);
    rendererSide.connect(inspectorSide);

    // Renderer side: serve the host.
    server = serveRendererHost(
      rendererSide,
      emitOutbound => new RendererHost(fake.renderer, emitOutbound),
    );

    // Inspector side: the RemoteRenderer drives the RPC transport.
    remote = new RemoteRenderer(createRpcRendererTransport(inspectorSide));

    // Prime the mirror across the wire.
    server.host.pushState();
  });

  afterEach(() => {
    remote.dispose();
    server.dispose();
  });

  describe('commands across the async boundary', () => {
    it('should deliver commands to the renderer host', async () => {
      remote.camera.zoom(2);
      remote.gizmos.setMode(GizmoType.SCALE);
      await flush();

      expect(fake.calls).toContain('camera.zoom:2');
      expect(fake.calls).toContain(`gizmos.setMode:${GizmoType.SCALE}`);
    });
  });

  describe('snapshot push feeds the mirror', () => {
    it('should make synchronous getters reflect pushed state', async () => {
      await flush(); // let the priming pushState() arrive

      expect(remote.camera.getSpeed()).toBe(4);
      expect(remote.metrics.getSceneMetrics()).toEqual({
        triangles: 42,
        bodies: 3,
        materials: 2,
        textures: 1,
      });
      expect(remote.viewport.getGroundPlanes()).toEqual([{ x: 8, z: 16 }]);
    });

    it('should refresh the mirror when the host re-pushes', async () => {
      fake.setSpeed(15);
      server.host.pushState();
      await flush();

      expect(remote.camera.getSpeed()).toBe(15);
    });
  });

  describe('events across the async boundary', () => {
    it('should deliver reverse-channel pick events to the inspector', async () => {
      const received: RendererEvents['pick'][] = [];
      remote.events.on('pick', e => received.push(e));

      fake.renderer.events.emit('pick', {
        target: { kind: 'entity', entity: 11 as Entity },
        modifiers: { multi: true },
      });
      await flush();

      expect(received).toEqual([
        { target: { kind: 'entity', entity: 11 }, modifiers: { multi: true } },
      ]);
    });
  });

  describe('async request across the boundary', () => {
    it('should round-trip getPointerWorldPoint', async () => {
      const point = await remote.getPointerWorldPoint();
      expect(point).toEqual({ x: 9, y: 0, z: 9 });
    });
  });
});
