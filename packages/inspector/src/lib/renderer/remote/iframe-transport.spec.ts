import mitt from 'mitt';
import type { Emitter } from 'mitt';
import { InMemoryTransport } from '@dcl/mini-rpc';
import type { Entity } from '@dcl/ecs';

import type { IRenderer, RendererEvents } from '../types';
import { createIframeRendererTransport } from './iframe-transport';
import { startRendererIframe } from './iframe-entry';
import { RemoteRenderer } from './RemoteRenderer';

function createFakeRenderer() {
  const events: Emitter<RendererEvents> = mitt<RendererEvents>();
  const calls: string[] = [];
  const renderer: IRenderer = {
    events,
    camera: {
      getSpeed: () => 7,
      reset: () => calls.push('camera.reset'),
      focusOnEntity: () => {},
      setInvertRotation: () => {},
      zoom: step => calls.push(`zoom:${step}`),
      getPose: () => ({ position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 1 }),
      setPose: () => {},
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
      getSceneMetrics: () => ({ triangles: 5, bodies: 1, materials: 1, textures: 0 }),
      getEntitiesOutsideLayout: () => [],
      onChange: () => () => {},
    },
    viewport: {
      onFrame: () => () => {},
      getGroundPlanes: () => [],
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
    setSelection: () => {},
    getPointerWorldPoint: async () => null,
    setGridVisible: () => {},
    dispose: () => calls.push('dispose'),
  };
  return { renderer, calls };
}

// Several macrotask turns: the mini-rpc connection handshake spans multiple
// rAF/macrotask hops (here rAF is stubbed onto setTimeout), so one turn isn't
// enough for the queue to flush and a message to complete its round trip.
const flush = async (turns = 10) => {
  for (let i = 0; i < turns; i++) await new Promise<void>(resolve => setTimeout(resolve, 0));
};

describe('iframe renderer transport', () => {
  // mini-rpc flushes its connection queue on requestAnimationFrame. happy-dom's
  // rAF doesn't sync with our setTimeout-based flush, so drive it off a macrotask
  // for the test (real browsers have a working rAF).
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(0), 0) as unknown as number;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should drive an out-of-process renderer over the simulated iframe boundary', async () => {
    const fake = createFakeRenderer();

    // Two connected in-memory transports stand in for the parent↔iframe
    // postMessage channel (the same mechanism MessageTransport rides on).
    const inspectorChannel = new InMemoryTransport();
    const rendererChannel = new InMemoryTransport();
    inspectorChannel.connect(rendererChannel);
    rendererChannel.connect(inspectorChannel);

    // Renderer side: as if running inside the iframe document.
    const iframeSide = startRendererIframe({
      createRenderer: () => fake.renderer,
      transport: rendererChannel,
    });

    // Inspector side: mount injects the inspector channel as the iframe transport.
    const transport = await createIframeRendererTransport({
      url: 'https://renderer.example/index.html',
      mount: async () => ({ transport: inspectorChannel, dispose: () => {} }),
    });
    const remote = new RemoteRenderer(transport);

    // Let the mini-rpc connection handshake settle, then push state so the
    // inspector mirror is primed once both sides are connected.
    await flush();
    iframeSide.host.pushState();
    await flush();

    // Sync read served from the mirror, fed across the simulated boundary.
    expect(remote.camera.getSpeed()).toBe(7);
    expect(remote.metrics.getSceneMetrics()).toEqual({
      triangles: 5,
      bodies: 1,
      materials: 1,
      textures: 0,
    });

    // Command crosses to the renderer.
    remote.camera.zoom(3);
    await flush();
    expect(fake.calls).toContain('zoom:3');

    // Reverse-channel event crosses back.
    const picks: RendererEvents['pick'][] = [];
    remote.events.on('pick', e => picks.push(e));
    fake.renderer.events.emit('pick', {
      target: { kind: 'entity', entity: 3 as Entity },
      modifiers: { multi: false },
    });
    await flush();
    expect(picks).toHaveLength(1);

    remote.dispose();
    iframeSide.dispose();
  });
});
