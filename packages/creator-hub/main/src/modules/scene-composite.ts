// Read-only reader for a scene's on-disk graph, for the AI assistant's scene tools.
//
// The Inspector's in-memory engine owns the scene and autosaves it to
// `assets/scene/main.composite` within ~100 ms of any change, so reading that file
// gives an effectively-live, read-only view without touching the engine or the
// renderer. The composite shape is:
//
//   { version, components: [ { name, data: { "<entityId>": { json: <value> }, ... } } ] }
//
// Every component keys its data by entity id (a numeric string); authored entities
// start at 512 (0 = scene root, 1/2 are reserved). Component names are namespaced
// (`core::Transform`, `core-schema::Name`, `inspector::…`, `asset-packs::…`).
import fs from 'fs/promises';
import path from 'path';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RosterEntity {
  id: number;
  name: string;
  kind: string;
  position?: Vec3;
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: Vec3;
  parent?: number;
  components: string[];
  gltf?: string;
  smartItem: boolean;
}

interface CompositeComponent {
  name: string;
  data: Record<string, { json: unknown }>;
}
interface Composite {
  version?: number;
  components?: CompositeComponent[];
}

const COMPOSITE_REL = path.join('assets', 'scene', 'main.composite');

// Internal bookkeeping components that add noise to a roster rather than describing
// what an entity *is*. Everything else (core::*, asset-packs::*, custom) is shown.
const HIDDEN_COMPONENTS = new Set([
  'composite::root',
  'core-schema::Network-Entity',
  'inspector::Selection',
  'inspector::Lock',
  'inspector::TransformConfig',
  'inspector::Nodes',
  'inspector::SceneMetadata',
]);

export function compositePath(projectDir: string): string {
  return path.join(projectDir, COMPOSITE_REL);
}

// Parse the scene composite from disk. Throws a readable error if it's missing or not
// valid JSON — the tool layer turns that into an MCP error result. Async so the read doesn't
// block the Electron main process on a large scene.
export async function readComposite(projectDir: string): Promise<Composite> {
  const file = compositePath(projectDir);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(`No scene composite found at ${COMPOSITE_REL}. Is a scene open?`);
  }
  try {
    return JSON.parse(raw) as Composite;
  } catch {
    throw new Error(`The scene composite at ${COMPOSITE_REL} is not valid JSON.`);
  }
}

// Short name without the namespace prefix, for display (`core::Transform` → `Transform`).
function shortName(component: string): string {
  const idx = component.lastIndexOf('::');
  return idx >= 0 ? component.slice(idx + 2) : component;
}

function asVec3(v: unknown): Vec3 | undefined {
  if (v === null || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.x === 'number' && typeof o.y === 'number' && typeof o.z === 'number') {
    return { x: o.x, y: o.y, z: o.z };
  }
  return undefined;
}

// One-word classification for a roster row, from the components present.
function kindOf(components: Set<string>): string {
  for (const c of components) if (c.startsWith('asset-packs::')) return 'smart-item';
  if (components.has('core::GltfContainer')) return 'model';
  if (components.has('core::TextShape')) return 'text';
  if (components.has('core::VideoPlayer')) return 'video';
  if (components.has('core::NftShape')) return 'nft';
  if (components.has('core::MeshRenderer')) return 'primitive';
  return 'entity';
}

interface EntityAccum {
  components: Set<string>;
  name?: string;
  transform?: Record<string, unknown>;
  gltf?: string;
}

// Index the composite by entity id, collecting each entity's components and the few
// values a roster cares about.
function indexEntities(composite: Composite): Map<number, EntityAccum> {
  const byId = new Map<number, EntityAccum>();
  const get = (id: number): EntityAccum => {
    let e = byId.get(id);
    if (e === undefined) {
      e = { components: new Set() };
      byId.set(id, e);
    }
    return e;
  };
  for (const comp of composite.components ?? []) {
    if (comp.data === null || typeof comp.data !== 'object') continue;
    for (const [idStr, cell] of Object.entries(comp.data)) {
      const id = Number(idStr);
      if (!Number.isFinite(id)) continue;
      const e = get(id);
      e.components.add(comp.name);
      const json = (cell as { json?: unknown })?.json;
      if (comp.name === 'core-schema::Name' && json !== null && typeof json === 'object') {
        const value = (json as Record<string, unknown>).value;
        if (typeof value === 'string') e.name = value;
      } else if (comp.name === 'core::Transform' && json !== null && typeof json === 'object') {
        e.transform = json as Record<string, unknown>;
      } else if (comp.name === 'core::GltfContainer' && json !== null && typeof json === 'object') {
        const src = (json as Record<string, unknown>).src;
        if (typeof src === 'string') e.gltf = src;
      }
    }
  }
  return byId;
}

// The addressable-entity roster: every named entity, most useful fields only. Callers
// cap the row count; the total is reported separately so truncation is never silent.
export function buildRoster(composite: Composite): { entities: RosterEntity[]; total: number } {
  const byId = indexEntities(composite);
  const rows: RosterEntity[] = [];
  for (const [id, e] of byId) {
    if (e.name === undefined) continue; // nameless entities aren't addressable
    const t = e.transform;
    rows.push({
      id,
      name: e.name,
      kind: kindOf(e.components),
      position: asVec3(t?.position),
      rotation: t?.rotation as RosterEntity['rotation'],
      scale: asVec3(t?.scale),
      parent: typeof t?.parent === 'number' ? (t.parent as number) : undefined,
      components: [...e.components]
        .filter(c => !HIDDEN_COMPONENTS.has(c))
        .map(shortName)
        .sort(),
      gltf: e.gltf,
      smartItem: [...e.components].some(c => c.startsWith('asset-packs::')),
    });
  }
  rows.sort((a, b) => a.id - b.id);
  return { entities: rows, total: rows.length };
}

// Every component's value for one entity, resolved by numeric id or by Name
// (case-insensitive). Returns null when nothing matches.
export function entityDetail(
  composite: Composite,
  entityRef: string,
): { id: number; name?: string; components: Record<string, unknown> } | null {
  const byId = indexEntities(composite);
  let targetId: number | undefined;
  const asNum = Number(entityRef);
  if (Number.isFinite(asNum) && byId.has(asNum)) {
    targetId = asNum;
  } else {
    const wanted = entityRef.trim().toLowerCase();
    for (const [id, e] of byId) {
      if (e.name !== undefined && e.name.toLowerCase() === wanted) {
        targetId = id;
        break;
      }
    }
  }
  if (targetId === undefined) return null;

  const components: Record<string, unknown> = {};
  for (const comp of composite.components ?? []) {
    if (comp.data === null || typeof comp.data !== 'object') continue;
    const cell = comp.data[String(targetId)];
    if (cell !== undefined) components[comp.name] = cell.json;
  }
  return { id: targetId, name: byId.get(targetId)?.name, components };
}

// Project-level metadata for the assistant: scene name/parcels/spawn from scene.json,
// plus the SDK version and dependencies from package.json. Best-effort — a missing or
// malformed file just omits its fields rather than failing the whole tool.
export async function projectInfo(projectDir: string): Promise<Record<string, unknown>> {
  const info: Record<string, unknown> = { path: projectDir };
  try {
    const scene = JSON.parse(await fs.readFile(path.join(projectDir, 'scene.json'), 'utf8'));
    info.scene = {
      name: scene.display?.title ?? scene.name,
      description: scene.display?.description,
      parcels: scene.scene?.parcels,
      base: scene.scene?.base,
      spawnPoints: scene.spawnPoints,
      main: scene.main,
      runtimeVersion: scene.runtimeVersion,
    };
  } catch {
    /* no/invalid scene.json */
  }
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    info.projectName = pkg.name;
    info.sdkVersion = deps['@dcl/sdk'];
    info.dependencies = deps;
  } catch {
    /* no/invalid package.json */
  }
  return info;
}
