import type { Entity } from '@dcl/ecs';

import type { IRenderer } from '../types';
import type {
  RendererCommand,
  RendererOutbound,
  RendererRequest,
  RendererRequestResult,
  RendererSnapshot,
} from './protocol';

/**
 * Renderer-side adapter for an out-of-process boundary.
 *
 * It wraps a real {@link IRenderer} (the in-process Babylon one, running in the
 * worker/iframe) and bridges it to the wire protocol: applies inbound commands,
 * answers requests, forwards the renderer's events outbound, and builds the
 * state {@link RendererSnapshot} pushed to the inspector-side mirror.
 *
 * The snapshot is what lets the inspector keep its reads synchronous. The host
 * pushes the cheap full state on demand (`pushSnapshot`) and the per-frame
 * spatial slice each frame (`pushFrame`) for the entities the inspector tracks.
 */
/** ~30Hz: the per-frame snapshot cadence (render loop runs at ~60Hz). */
const FRAME_PUSH_INTERVAL_MS = 33;

export class RendererHost {
  #disposers: Array<() => void> = [];
  #trackedEntities: Entity[] = [];
  #lastFramePush = 0;

  constructor(
    private readonly renderer: IRenderer,
    private readonly emitOutbound: (message: RendererOutbound) => void,
  ) {
    // Forward every reverse-channel event over the wire verbatim.
    const forward =
      <K extends keyof typeof EVENT_NAMES>(event: K) =>
      (payload: unknown) =>
        this.emitOutbound({ kind: 'event', event, payload } as RendererOutbound);

    for (const name of Object.keys(EVENT_NAMES) as Array<keyof typeof EVENT_NAMES>) {
      const handler = forward(name);
      this.renderer.events.on(name, handler as never);
      this.#disposers.push(() => this.renderer.events.off(name, handler as never));
    }

    // Keep the per-frame spatial slice flowing while a frame subscription is live.
    this.#disposers.push(this.renderer.viewport.onFrame(() => this.pushFrame()));
    // Re-push the cheap state whenever metrics/gizmos signal a change.
    this.#disposers.push(this.renderer.metrics.onChange(() => this.pushState()));
    this.#disposers.push(this.renderer.gizmos.onChange(() => this.pushState()));
  }

  /** Apply a command from the inspector to the wrapped renderer. */
  handleCommand(command: RendererCommand): void {
    const r = this.renderer;
    switch (command.kind) {
      case 'setSelection':
        return r.setSelection(command.entities);
      case 'setGridVisible':
        return r.setGridVisible(command.visible);
      case 'camera.reset':
        return r.camera.reset();
      case 'camera.focusOnEntity':
        return r.camera.focusOnEntity(command.entity);
      case 'camera.setInvertRotation':
        return r.camera.setInvertRotation(command.invert);
      case 'camera.zoom':
        return r.camera.zoom(command.step);
      case 'camera.setPose':
        return r.camera.setPose(command.position, command.target);
      case 'camera.setControlEnabled':
        return r.camera.setControlEnabled(command.enabled);
      case 'gizmos.setEnabled':
        return r.gizmos.setEnabled(command.enabled);
      case 'gizmos.setMode':
        return r.gizmos.setMode(command.mode);
      case 'gizmos.setWorldAligned':
        return r.gizmos.setWorldAligned(command.aligned);
      case 'spawnPoints.select':
        return r.spawnPoints.select(command.index);
      case 'spawnPoints.selectCameraTarget':
        return r.spawnPoints.selectCameraTarget(command.index);
      case 'spawnPoints.setVisible':
        return r.spawnPoints.setVisible(command.index, command.name, command.visible);
      case 'spawnPoints.attachGizmo':
        // Drag-position feedback isn't streamed back over the wire yet; the
        // handle still attaches in the renderer.
        return r.spawnPoints.attachGizmo(command.index, command.target, () => {});
      case 'spawnPoints.detachGizmo':
        return r.spawnPoints.detachGizmo();
      case 'spawnPoints.setPosition':
        return r.spawnPoints.setPosition(command.index, command.target, command.position);
      case 'debug.toggle':
        return r.debug?.toggle();
    }
  }

  /** Answer an inspector request (the genuinely-async paths). */
  async handleRequest<K extends RendererRequest['kind']>(
    request: Extract<RendererRequest, { kind: K }>,
  ): Promise<RendererRequestResult[K]> {
    switch (request.kind) {
      case 'getPointerWorldPoint':
        return (await this.renderer.getPointerWorldPoint()) as RendererRequestResult[K];
      case 'getEntityAnimations': {
        const { entity } = request as Extract<RendererRequest, { kind: 'getEntityAnimations' }>;
        return (await this.renderer.getEntityAnimations(
          entity,
        )) as unknown as RendererRequestResult[K];
      }
      default:
        throw new Error(`Unknown renderer request: ${(request as { kind: string }).kind}`);
    }
  }

  /**
   * Tell the host which entities the inspector cares about for per-frame
   * positions (the minimap's tracked set). Keeps frame payloads bounded.
   */
  setTrackedEntities(entities: Entity[]): void {
    this.#trackedEntities = entities;
  }

  /** Push the full, cheap state slice (camera/gizmos/spawn/metrics/ground). */
  pushState(): void {
    const r = this.renderer;
    const pose = r.camera.getPose();
    const sp = r.spawnPoints;
    const snapshot: Partial<RendererSnapshot> = {
      camera: {
        speed: r.camera.getSpeed(),
        position: pose.position,
        target: pose.target,
        fov: pose.fov,
      },
      gizmos: {
        enabled: r.gizmos.isEnabled(),
        worldAligned: r.gizmos.isWorldAligned(),
        worldAlignmentDisabled: r.gizmos.isWorldAlignmentDisabled(),
      },
      spawnPoints: {
        selectedIndex: sp.getSelectedIndex(),
        selectedTarget: sp.getSelectedTarget(),
        hidden: [],
      },
      metrics: r.metrics.getSceneMetrics(),
      entitiesOutsideLayout: r.metrics.getEntitiesOutsideLayout(),
      groundPlanes: r.viewport.getGroundPlanes(),
    };
    this.emitOutbound({ kind: 'snapshot', snapshot });
  }

  /**
   * Push the per-frame spatial slice (camera pose + tracked entity positions).
   * Throttled to {@link FRAME_PUSH_INTERVAL_MS}: the render loop calls this at
   * ~60Hz, but the inspector overlays (minimap) only need ~30Hz, so we halve the
   * serialize+postMessage cost. Also a no-op when nothing is tracked.
   */
  pushFrame(): void {
    const now = Date.now();
    if (now - this.#lastFramePush < FRAME_PUSH_INTERVAL_MS) return;
    this.#lastFramePush = now;

    const r = this.renderer;
    const pose = r.camera.getPose();
    const positions = r.viewport.getEntityWorldPositions(this.#trackedEntities);
    this.emitOutbound({
      kind: 'snapshot',
      snapshot: {
        camera: {
          speed: r.camera.getSpeed(),
          position: pose.position,
          target: pose.target,
          fov: pose.fov,
        },
        entityPositions: Array.from(positions.entries()),
      },
    });
  }

  dispose(): void {
    for (const off of this.#disposers) off();
    this.#disposers = [];
  }
}

// The set of reverse-channel events the host forwards. Keyed object so we can
// iterate names without pulling a value-level enum from the type-only contract.
const EVENT_NAMES = {
  ready: true,
  pick: true,
  gizmoCommit: true,
  gizmoCommitEnd: true,
  cameraChange: true,
  cameraSpeedChange: true,
} as const;
