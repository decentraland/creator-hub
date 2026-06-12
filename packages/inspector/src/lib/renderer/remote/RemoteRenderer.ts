import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';
import type { Vector3 } from '@dcl/ecs-math';

import type { GizmoType } from '../../utils/gizmo';
import type {
  GroundPlane,
  IRenderer,
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
import type { AssetProvider, RendererSnapshot, RendererTransport } from './protocol';

const EMPTY_SNAPSHOT: RendererSnapshot = {
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
  #frameHandlers = new Set<() => void>();
  #gizmoChangeHandlers = new Set<() => void>();
  #metricsChangeHandlers = new Set<() => void>();
  #spawnSelectionHandlers = new Set<
    (e: { index: number | null; target: SpawnPointTarget | null }) => void
  >();
  #spawnVisibilityHandlers = new Set<(e: { name: string; visible: boolean }) => void>();
  #disposeOutbound: () => void;
  #disposeRequest: (() => void) | undefined;

  constructor(
    private readonly transport: RendererTransport,
    assets?: AssetProvider,
  ) {
    this.#disposeOutbound = transport.onOutbound(message => {
      if (message.kind === 'event') {
        // Forward the renderer's reverse-channel events onto the local bus.
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
  }

  #applySnapshot(partial: Partial<RendererSnapshot>) {
    const prev = this.#snapshot;
    this.#snapshot = { ...prev, ...partial };

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
        // Rebuild the Map from the pushed pairs, filtered to the requested ids.
        const all = new Map(this.#snapshot.entityPositions);
        const result = new Map<Entity, Vector3>();
        for (const entity of entities) {
          const pos = all.get(entity);
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
