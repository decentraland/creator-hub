import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import type { Vector3 } from '@dcl/ecs-math';

import type { GizmoType } from '../../utils/gizmo';
import type {
  GroundPlane,
  IRenderer,
  RendererAnimation,
  RendererCamera,
  RendererDebug,
  RendererEvents,
  RendererGizmos,
  RendererMetrics,
  RendererViewport,
  SpawnPointController,
  SpawnPointTarget,
  Unsubscribe,
} from '../types';
import { PROTOCOL_VERSION } from './protocol';
import type { AssetProvider, RendererSnapshot, RendererTransport } from './protocol';

const EMPTY_SNAPSHOT: RendererSnapshot = {
  version: 0,
  camera: { speed: 0, position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 0 },
  gizmos: { enabled: false, worldAligned: true, worldAlignmentDisabled: false },
  spawnPoints: { selectedIndex: null, selectedTarget: null, hidden: [] },
  metrics: { triangles: 0, bodies: 0, materials: 0, textures: 0 },
  entitiesOutsideLayout: [],
  groundPlanes: [],
  entityPositions: [],
};

/**
 * Inspector-side {@link IRenderer} for an out-of-process renderer.
 *
 * It satisfies the synchronous contract without ever blocking on the boundary:
 * reads come from a **local mirror** the renderer keeps fresh via snapshot
 * pushes; commands are fire-and-forget over the transport; the two genuinely
 * async methods (`pickAt`, `getPointerWorldPoint`) round-trip via request; and
 * `events` is a local bus fed by inbound event messages.
 *
 * Consumers cannot tell this apart from the in-process {@link BabylonRenderer}
 * — that is the whole point of the boundary.
 */
export class RemoteRenderer implements IRenderer {
  readonly events: Emitter<RendererEvents> = mitt<RendererEvents>();

  readonly camera: RendererCamera;
  readonly gizmos: RendererGizmos;
  readonly metrics: RendererMetrics;
  readonly viewport: RendererViewport;
  readonly spawnPoints: SpawnPointController;
  readonly debug: RendererDebug;

  #snapshot: RendererSnapshot = EMPTY_SNAPSHOT;
  // Cached lookup view of `#snapshot.entityPositions`, rebuilt only when that
  // slice arrives in a snapshot (~30Hz) rather than on every viewport read.
  #entityPositionMap = new Map<Entity, Vector3>();
  #frameHandlers = new Set<() => void>();
  #gizmoChangeHandlers = new Set<() => void>();
  #metricsChangeHandlers = new Set<() => void>();
  #spawnSelectionHandlers = new Set<
    (e: { index: number | null; target: SpawnPointTarget | null }) => void
  >();
  #spawnVisibilityHandlers = new Set<(e: { name: string; visible: boolean }) => void>();
  #disposeOutbound: () => void;
  #disposeRequest: (() => void) | undefined;
  #warnedSkew = false;

  constructor(
    private readonly transport: RendererTransport,
    assets?: AssetProvider,
  ) {
    this.#disposeOutbound = transport.onOutbound(message => {
      if (message.kind === 'event') {
        // Forward the renderer's reverse-channel events onto the local bus.
        // `event` and `payload` are a correlated pair on the wire but the type
        // system can't re-correlate them after deserialization, so `as never`
        // bridges into mitt's `emit<K>(type, Events[K])`. Runtime-safe: the host
        // only ever emits matching (event, payload) pairs (see EVENT_NAMES).
        this.events.emit(message.event, message.payload as never);
      } else {
        this.#applySnapshot(message.snapshot);
      }
    });

    // Serve renderer→inspector requests (asset loading) when both an asset
    // provider and a transport that supports the reverse direction are present.
    if (assets && transport.onRequest) {
      this.#disposeRequest = transport.onRequest(async request => {
        switch (request.kind) {
          case 'getFile':
            return (await assets.getFile(request.src)) as never;
          default:
            return null as never;
        }
      });
    }

    this.camera = this.#createCamera();
    this.gizmos = this.#createGizmos();
    this.metrics = this.#createMetrics();
    this.viewport = this.#createViewport();
    this.spawnPoints = this.#createSpawnPoints();
    this.debug = this.#createDebug();

    // Request a full snapshot now that we're listening. mini-rpc queues this
    // until the handshake completes, so it's delivered once the channel is live
    // — avoiding the race where the host's synchronous initial push is dropped
    // and the mirror is stranded at EMPTY_SNAPSHOT.
    this.transport.sendCommand({ kind: 'requestSnapshot' });
  }

  #applySnapshot(partial: Partial<RendererSnapshot>) {
    // Warn once on protocol-version skew between inspector and renderer.
    if (
      partial.version !== undefined &&
      partial.version !== PROTOCOL_VERSION &&
      !this.#warnedSkew
    ) {
      this.#warnedSkew = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[renderer] protocol version skew: inspector=${PROTOCOL_VERSION}, renderer=${partial.version}`,
      );
    }
    const prev = this.#snapshot;
    this.#snapshot = { ...prev, ...partial };

    // Rebuild the lookup view once per snapshot that carries new positions,
    // not on every getEntityWorldPositions read.
    if (partial.entityPositions) {
      this.#entityPositionMap = new Map(partial.entityPositions);
    }

    // Fire the mirror's own change subscriptions when the relevant slice moved.
    if (partial.entityPositions || partial.camera || partial.groundPlanes) {
      for (const h of this.#frameHandlers) h();
    }
    if (partial.gizmos) for (const h of this.#gizmoChangeHandlers) h();
    if (partial.metrics || partial.entitiesOutsideLayout)
      for (const h of this.#metricsChangeHandlers) h();
    if (partial.spawnPoints) {
      const sp = partial.spawnPoints;
      for (const h of this.#spawnSelectionHandlers)
        h({ index: sp.selectedIndex, target: sp.selectedTarget });

      // Fire visibility handlers for any name whose hidden-state changed since
      // the previous snapshot (diff prev vs next `hidden` sets).
      const prevHidden = new Set(prev.spawnPoints.hidden);
      const nextHidden = new Set(sp.hidden);
      for (const name of prevHidden) {
        if (!nextHidden.has(name)) {
          for (const h of this.#spawnVisibilityHandlers) h({ name, visible: true });
        }
      }
      for (const name of nextHidden) {
        if (!prevHidden.has(name)) {
          for (const h of this.#spawnVisibilityHandlers) h({ name, visible: false });
        }
      }
    }
  }

  #createCamera(): RendererCamera {
    return {
      getSpeed: () => this.#snapshot.camera.speed,
      reset: () => this.transport.sendCommand({ kind: 'camera.reset' }),
      focusOnEntity: entity => this.transport.sendCommand({ kind: 'camera.focusOnEntity', entity }),
      setInvertRotation: invert =>
        this.transport.sendCommand({ kind: 'camera.setInvertRotation', invert }),
      zoom: step => this.transport.sendCommand({ kind: 'camera.zoom', step }),
      getPose: () => {
        const { position, target, fov } = this.#snapshot.camera;
        return { position, target, fov };
      },
      setPose: (position, target) =>
        this.transport.sendCommand({ kind: 'camera.setPose', position, target }),
      setControlEnabled: enabled =>
        this.transport.sendCommand({ kind: 'camera.setControlEnabled', enabled }),
    };
  }

  #createGizmos(): RendererGizmos {
    return {
      isEnabled: () => this.#snapshot.gizmos.enabled,
      setEnabled: enabled => this.transport.sendCommand({ kind: 'gizmos.setEnabled', enabled }),
      setMode: (mode: GizmoType) => this.transport.sendCommand({ kind: 'gizmos.setMode', mode }),
      isWorldAligned: () => this.#snapshot.gizmos.worldAligned,
      setWorldAligned: aligned =>
        this.transport.sendCommand({ kind: 'gizmos.setWorldAligned', aligned }),
      isWorldAlignmentDisabled: () => this.#snapshot.gizmos.worldAlignmentDisabled,
      onChange: (cb): Unsubscribe => {
        this.#gizmoChangeHandlers.add(cb);
        return () => this.#gizmoChangeHandlers.delete(cb);
      },
    };
  }

  #createMetrics(): RendererMetrics {
    return {
      getSceneMetrics: () => this.#snapshot.metrics,
      getEntitiesOutsideLayout: () => this.#snapshot.entitiesOutsideLayout,
      onChange: (cb): Unsubscribe => {
        this.#metricsChangeHandlers.add(cb);
        return () => this.#metricsChangeHandlers.delete(cb);
      },
    };
  }

  #createViewport(): RendererViewport {
    return {
      onFrame: (cb): Unsubscribe => {
        this.#frameHandlers.add(cb);
        return () => this.#frameHandlers.delete(cb);
      },
      getGroundPlanes: (): GroundPlane[] => this.#snapshot.groundPlanes,
      getEntityWorldPositions: (entities: Entity[]): Map<Entity, Vector3> => {
        // Read from the cached view (rebuilt in #applySnapshot), filtered to
        // the requested ids.
        const result = new Map<Entity, Vector3>();
        for (const entity of entities) {
          const pos = this.#entityPositionMap.get(entity);
          if (pos) result.set(entity, pos);
        }
        return result;
      },
    };
  }

  #createSpawnPoints(): SpawnPointController {
    return {
      getSelectedIndex: () => this.#snapshot.spawnPoints.selectedIndex,
      getSelectedTarget: () => this.#snapshot.spawnPoints.selectedTarget,
      isHidden: name => this.#snapshot.spawnPoints.hidden.includes(name),
      select: index => this.transport.sendCommand({ kind: 'spawnPoints.select', index }),
      selectCameraTarget: index =>
        this.transport.sendCommand({ kind: 'spawnPoints.selectCameraTarget', index }),
      setVisible: (index, name, visible) =>
        this.transport.sendCommand({ kind: 'spawnPoints.setVisible', index, name, visible }),
      onSelectionChange: cb => {
        this.#spawnSelectionHandlers.add(cb);
        return () => this.#spawnSelectionHandlers.delete(cb);
      },
      onVisibilityChange: cb => {
        this.#spawnVisibilityHandlers.add(cb);
        return () => this.#spawnVisibilityHandlers.delete(cb);
      },
      attachGizmo: (index, target) =>
        // NOTE: the drag-position callback is not delivered out-of-process yet
        // (it would need a dedicated event channel). The handle attaches; live
        // position feedback during a spawn-point drag is future work.
        this.transport.sendCommand({ kind: 'spawnPoints.attachGizmo', index, target }),
      detachGizmo: () => this.transport.sendCommand({ kind: 'spawnPoints.detachGizmo' }),
      setPosition: (index, target, position) =>
        this.transport.sendCommand({ kind: 'spawnPoints.setPosition', index, target, position }),
    };
  }

  #createDebug(): RendererDebug {
    return {
      // No mirrored visibility state is needed by callers today; toggle is a command.
      isVisible: () => false,
      toggle: () => this.transport.sendCommand({ kind: 'debug.toggle' }),
    };
  }

  setSelection(entities: Entity[]): void {
    this.transport.sendCommand({ kind: 'setSelection', entities });
  }

  getPointerWorldPoint(): Promise<Vector3 | null> {
    return this.transport.request({ kind: 'getPointerWorldPoint' });
  }

  getEntityAnimations(entity: Entity): Promise<RendererAnimation[]> {
    return this.transport.request({ kind: 'getEntityAnimations', entity });
  }

  setGridVisible(visible: boolean): void {
    this.transport.sendCommand({ kind: 'setGridVisible', visible });
  }

  dispose(): void {
    this.#disposeOutbound();
    this.#disposeRequest?.();
    this.transport.dispose();
    this.events.all.clear();
    this.#frameHandlers.clear();
    this.#gizmoChangeHandlers.clear();
    this.#metricsChangeHandlers.clear();
    this.#spawnSelectionHandlers.clear();
    this.#spawnVisibilityHandlers.clear();
  }
}
