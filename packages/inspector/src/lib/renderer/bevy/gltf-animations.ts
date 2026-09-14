import type { Entity } from '@dcl/ecs';

/**
 * Animation clip names of an entity's GLTF, read from the model FILE itself.
 *
 * Why not ask the engine: bevy-explorer writes `GltfContainerLoadingState` on the
 * renderer side, but every console read command answers from the scene thread's
 * copy of the world, which a frozen editor scene only refreshes on a tick. Ticking
 * the scene to read it would run the scene's systems for a frame per edit — not
 * acceptable while editing. The editor agent can't help either: its SDK getters
 * see only its own scene. The names live in the GLTF's JSON, so parse that — no
 * engine round trip, no tick, and available before the engine has loaded the model.
 *
 * Naming mirrors the engine (`GltfNames::extract` in bevy-explorer's
 * gltf_container.rs): an unnamed animation is `Animation<index>`, zero-based.
 */

const GLB_MAGIC = 0x46546c67;
const GLB_CHUNK_JSON = 0x4e4f534a;
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;

interface GltfJson {
  animations?: { name?: unknown }[];
}

function readGlbJsonChunk(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES) return null;
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  const chunkLength = view.getUint32(GLB_HEADER_BYTES, true);
  const chunkType = view.getUint32(GLB_HEADER_BYTES + 4, true);
  if (chunkType !== GLB_CHUNK_JSON) return null;
  const start = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES;
  const end = Math.min(start + chunkLength, bytes.byteLength);
  return new TextDecoder().decode(bytes.subarray(start, end));
}

/** The animation clip names declared by a GLB or glTF file; [] when it has none or is malformed. */
export function parseGltfAnimationNames(bytes: Uint8Array): string[] {
  const json = readGlbJsonChunk(bytes) ?? new TextDecoder().decode(bytes);
  let gltf: GltfJson;
  try {
    gltf = JSON.parse(json) as GltfJson;
  } catch {
    return [];
  }
  if (!Array.isArray(gltf.animations)) return [];
  return gltf.animations.map((animation, index) =>
    typeof animation?.name === 'string' && animation.name !== ''
      ? animation.name
      : `Animation${index}`,
  );
}

export interface GltfAnimationsLookupOptions {
  /** The entity's GltfContainer `src`, from the renderer's engine; null when it has none (yet). */
  getSrc: (entity: Entity) => string | null;
  /** Load a scene file's bytes by path; null when unavailable (the mount context's `loadAsset`). */
  loadAsset: (src: string) => Promise<Uint8Array | null>;
  /** How long to wait for a just-created entity's GltfContainer to arrive on the engine. */
  srcWaitMs?: number;
  srcPollMs?: number;
}

export interface GltfAnimationsLookup {
  /** Clip names of `entity`'s model; [] when it has no model, the file is unreadable, or it has no clips. */
  query(entity: Entity): Promise<string[]>;
  dispose(): void;
}

const DEFAULT_SRC_WAIT_MS = 2000;
const DEFAULT_SRC_POLL_MS = 100;

export function createGltfAnimationsLookup(
  options: GltfAnimationsLookupOptions,
): GltfAnimationsLookup {
  const srcWaitMs = options.srcWaitMs ?? DEFAULT_SRC_WAIT_MS;
  const srcPollMs = options.srcPollMs ?? DEFAULT_SRC_POLL_MS;
  let disposed = false;
  // Concurrent askers (the Animator and Action panels select together) share one read.
  const inflightBySrc = new Map<string, Promise<string[]>>();
  const sleepers = new Set<() => void>();

  const sleep = (): Promise<void> =>
    new Promise<void>(resolve => {
      const wake = () => {
        clearTimeout(timer);
        sleepers.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, srcPollMs);
      sleepers.add(wake);
    });

  // The panel asks the moment an entity is selected; a freshly dropped model's
  // GltfContainer can land on the renderer's engine a beat later. Wait briefly.
  const awaitSrc = async (entity: Entity): Promise<string | null> => {
    const deadline = Date.now() + srcWaitMs;
    while (!disposed) {
      const src = options.getSrc(entity);
      if (src) return src;
      if (Date.now() >= deadline) return null;
      await sleep();
    }
    return null;
  };

  const readNames = (src: string): Promise<string[]> => {
    const pending = inflightBySrc.get(src);
    if (pending) return pending;
    const promise = options
      .loadAsset(src)
      .then(bytes => (bytes && !disposed ? parseGltfAnimationNames(bytes) : []))
      .catch(() => [])
      .finally(() => {
        inflightBySrc.delete(src);
      });
    inflightBySrc.set(src, promise);
    return promise;
  };

  const query = async (entity: Entity): Promise<string[]> => {
    const src = await awaitSrc(entity);
    return src ? readNames(src) : [];
  };

  const dispose = () => {
    disposed = true;
    for (const wake of Array.from(sleepers)) wake();
  };

  return { query, dispose };
}
