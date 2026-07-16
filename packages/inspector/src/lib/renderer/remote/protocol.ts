import type { Entity } from '@dcl/ecs';
import type { Vector3 } from '@dcl/ecs-math';

import type { GizmoType } from '../../utils/gizmo';
import type { GroundPlane, RendererAnimation, RendererEvents, SpawnPointTarget } from '../types';

/**
 * Wire-protocol version. Bump on any breaking change to the message shapes.
 * The host reports it in its first snapshot so the inspector can detect skew
 * between independently-deployed inspector and out-of-process renderer.
 */
export const PROTOCOL_VERSION = 1;

/**
 * Wire protocol for an out-of-process renderer.
 *
 * The renderer-agnostic {@link IRenderer} contract has *synchronous* getters
 * (`camera.getSpeed()`, `viewport.getEntityWorldPositions()`, …) and a per-frame
 * read path (the minimap, ~10Hz). postMessage / RPC is asynchronous and cannot
 * satisfy a synchronous return, and the per-frame path cannot afford a
 * request/response round-trip every frame.
 *
 * Resolution: **RPC is the transport; a local state mirror keeps reads sync.**
 *  - Commands (inspector → renderer) are fire-and-forget messages.
 *  - Events (renderer → inspector) are the reverse channel (pick/gizmoCommit/…).
 *  - The renderer *pushes* a small {@link RendererSnapshot} (debounced + once per
 *    frame for the spatial part) so the inspector can answer every sync getter
 *    from a local cache without crossing the boundary.
 *
 * Everything here is plain JSON-serializable data: entity IDs are numbers,
 * vectors are `{x,y,z}`. No renderer object, no Map, no class instance crosses
 * the wire. The mirror rebuilds richer shapes (e.g. Map) on the inspector side.
 */

// --- Commands: inspector → renderer ---------------------------------------

export type RendererCommand =
  | { kind: 'setSelection'; entities: Entity[] }
  | { kind: 'setGridVisible'; visible: boolean }
  | { kind: 'camera.reset' }
  | { kind: 'camera.focusOnEntity'; entity: Entity }
  | { kind: 'camera.setInvertRotation'; invert: boolean }
  | { kind: 'camera.zoom'; step: number }
  | { kind: 'camera.setPose'; position: Vector3; target: Vector3 }
  | { kind: 'camera.setControlEnabled'; enabled: boolean }
  | { kind: 'gizmos.setEnabled'; enabled: boolean }
  | { kind: 'gizmos.setMode'; mode: GizmoType }
  | { kind: 'gizmos.setWorldAligned'; aligned: boolean }
  | { kind: 'spawnPoints.select'; index: number | null }
  | { kind: 'spawnPoints.selectCameraTarget'; index: number }
  | { kind: 'spawnPoints.setVisible'; index: number; name: string; visible: boolean }
  | { kind: 'spawnPoints.attachGizmo'; index: number; target: SpawnPointTarget }
  | { kind: 'spawnPoints.detachGizmo' }
  | { kind: 'spawnPoints.setPosition'; index: number; target: SpawnPointTarget; position: Vector3 }
  | { kind: 'debug.toggle' }
  // Sent by the inspector once the channel is connected, so the host pushes a
  // full snapshot *after* the handshake (the synchronous initial push at mount
  // can be dropped before the connection is live).
  | { kind: 'requestSnapshot' };

// --- Requests: inspector → renderer, awaiting one response -----------------
// For the genuinely async operations the contract already exposes as Promises
// or callbacks-with-result. These DO round-trip; that's acceptable because they
// are user-initiated one-offs, not per-frame.

export type RendererRequest =
  | { kind: 'getPointerWorldPoint' }
  | { kind: 'getEntityAnimations'; entity: Entity };

export type RendererRequestResult = {
  getPointerWorldPoint: Vector3 | null;
  getEntityAnimations: RendererAnimation[];
};

// --- Requests: renderer → inspector, awaiting one response -----------------
// The reverse direction. An out-of-process renderer cannot reach the inspector's
// data layer to load assets, so it asks for file bytes across the boundary. The
// inspector resolves them against the scene content mappings and ships the bytes
// back (Uint8Array → transferable over a real worker/iframe).

export type InspectorRequest = { kind: 'getFile'; src: string };

export type InspectorRequestResult = {
  getFile: Uint8Array | null;
};

// --- Events: renderer → inspector ------------------------------------------
// The reverse channel, plus snapshot pushes. Reuses RendererEvents verbatim for
// the interaction events so the host can forward them unchanged.

export type RendererOutbound =
  | { kind: 'event'; event: OutboundEventName; payload: OutboundEventPayload }
  | { kind: 'snapshot'; snapshot: Partial<RendererSnapshot> };

export type OutboundEventName = keyof RendererEvents;
export type OutboundEventPayload = RendererEvents[OutboundEventName];

// --- Snapshot: the pushed state the mirror answers sync reads from ---------

/**
 * Each sub-object MUST be sent whole (the inspector-side mirror shallow-merges
 * top-level keys; a partial sub-object would drop its unsent fields).
 *
 * Known out-of-process gaps vs the in-process renderer (intentional for now):
 *  - `spawnPoints.hidden` is not yet populated by the host, so `isHidden`/
 *    `onVisibilityChange` are inert out-of-process.
 *  - debug-overlay visibility is not mirrored (RemoteRenderer.debug.isVisible
 *    returns false).
 *  - the spawn-gizmo drag-position callback is not streamed back over the wire.
 * The reverse channel also assumes the renderer pre-mutates its own
 * spawn-point selection before emitting a `spawnPoint` pick (the inspector only
 * mirrors ECS selection) — a remote renderer must replicate that.
 */
export interface RendererSnapshot {
  /** {@link PROTOCOL_VERSION} at the host. Sent with the full state push so the
   * inspector can detect version skew. Omitted on per-frame slices. */
  version: number;
  camera: { speed: number; position: Vector3; target: Vector3; fov: number };
  gizmos: { enabled: boolean; worldAligned: boolean; worldAlignmentDisabled: boolean };
  spawnPoints: {
    selectedIndex: number | null;
    selectedTarget: SpawnPointTarget | null;
    hidden: string[];
  };
  metrics: { triangles: number; bodies: number; materials: number; textures: number };
  /** Entities currently outside the layout bounds. */
  entitiesOutsideLayout: Entity[];
  /** Ground/parcel plane centers. */
  groundPlanes: GroundPlane[];
  /** Per-frame entity world positions, as `[entity, {x,y,z}]` pairs (Map on the wire). */
  entityPositions: Array<[Entity, Vector3]>;
}

/**
 * The transport both sides talk through. The loopback implementation passes
 * messages in-process (optionally through a JSON round-trip to prove
 * serializability); a future implementation wraps mini-rpc over a
 * Worker/iframe MessageTransport.
 */
export interface RendererTransport {
  /** Inspector → renderer: fire-and-forget command. */
  sendCommand(command: RendererCommand): void;
  /** Inspector → renderer: request awaiting a single typed response. */
  request<K extends RendererRequest['kind']>(
    request: Extract<RendererRequest, { kind: K }>,
  ): Promise<RendererRequestResult[K]>;
  /** Renderer → inspector: subscribe to events and snapshot pushes. */
  onOutbound(handler: (message: RendererOutbound) => void): () => void;
  /**
   * Inspector side: register the handler that answers renderer→inspector
   * requests (asset loading). Optional — a transport may be used purely
   * inspector-driven, but out-of-process renderers need it for assets.
   */
  onRequest?(
    handler: <K extends InspectorRequest['kind']>(
      request: Extract<InspectorRequest, { kind: K }>,
    ) => Promise<InspectorRequestResult[K]>,
  ): () => void;
  /** Renderer side: ask the inspector to fulfil a request (asset loading). */
  requestInspector?<K extends InspectorRequest['kind']>(
    request: Extract<InspectorRequest, { kind: K }>,
  ): Promise<InspectorRequestResult[K]>;
  dispose(): void;
}

/** What the inspector side provides to answer renderer asset requests. */
export interface AssetProvider {
  getFile(src: string): Promise<Uint8Array | null>;
}
