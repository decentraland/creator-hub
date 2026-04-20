/**
 * External store for entries received from a Mobile Debug Session.
 * Follows the same pattern as debug-log-store.ts — useSyncExternalStore compatible.
 */

// ── Types ─────────────────────────────────────────────────────────

export interface CrdtEntry {
  type: 'crdt';
  sid: number; // scene id
  tk: number; // tick
  t: number; // timestamp
  d: string; // direction: s2r | r2s
  e: number; // entity id
  c: string; // component name
  op: string; // operation: p | d | de | a
  ct: number; // crdt timestamp
  payload?: unknown;
  bin?: string;
  l: number; // raw size bytes
}

export interface ConsoleEntry {
  timestamp: number;
  tick: number | null;
  sceneId: number | null;
  level: 'log' | 'error';
  message: string;
}

export interface ReconstructResult {
  state: Record<number, EntityState>;
  truncated: boolean;
  oldestAvailableTick: number | null;
}

export interface SceneTickInfo {
  maxTick: number;
  tickCount: number;
}

export interface PerfSnapshot {
  fps: number;
  dt: number;
  draw_calls: number;
  primitives: number;
  objects_in_frame: number;
  mem_static_mb: number;
  mem_gpu_mb: number;
  mem_rust_mb: number;
  js_heap_total_mb: number;
  js_heap_used_mb: number;
  js_heap_limit_mb: number;
  js_external_mb: number;
  assets_loading: number;
  assets_loaded: number;
  download_speed_mbs: number;
  scene_count: number;
}

export interface MobileDebugSessionInfo {
  id: number;
  sessionId: string | null;
  deviceName: string | null;
  status: 'active' | 'ended';
  messageCount: number;
}

export interface SceneInfo {
  sceneId: number;
  title: string;
  baseParcel: string;
}

export interface RemoteStatus {
  paused: boolean;
  session_id: string;
  scene_inspector_active: boolean;
  file_logging: boolean;
  entry_count: number;
  perf_interval: number;
}

interface EntityState {
  components: Record<string, unknown>;
  parent: number;
}

// ── State ─────────────────────────────────────────────────────────

const GOS_LIMIT = 100;
const MAX_CONSOLE = 1000;
const MAX_CHANGES_PER_ENTITY = 200;
const MAX_PERF_HISTORY = 60; // ~2 min at 2s interval
const MAX_ALL_CRDT = 50_000; // buffer for tick reconstruction
const MAX_TICK_SET = MAX_ALL_CRDT;
const UPDATE_TIME_TTL_MS = 5 * 60_000;

let entities: Record<number, EntityState> = {};
let entityChanges: Record<number, CrdtEntry[]> = {};
let consoleEntries: ConsoleEntry[] = [];
let sessions: MobileDebugSessionInfo[] = [];
let latestPerf: PerfSnapshot | null = null;
let perfHistory: PerfSnapshot[] = [];
let totalCrdt = 0;
let totalOps = 0;
let totalConsole = 0;
let isPaused = false;
let remoteStatus: RemoteStatus | null = null;

// Scene tracking
let knownScenes: Map<number, SceneInfo> = new Map();

// Per-scene tick tracking
interface PerSceneTicks {
  maxTick: number;
  tickSet: Set<number>;
}
let perSceneTicks: Map<number, PerSceneTicks> = new Map();

// Update highlighting: entity_id → timestamp of last update
let entityUpdateTimes: Record<number, number> = {};
// Component-level: `${entity_id}:${component_name}` → timestamp
let componentUpdateTimes: Record<string, number> = {};

// Full CRDT log for reconstruction
let allCrdtEntries: CrdtEntry[] = [];

// One-shot diagnostics
const seenUnknownOps: Set<string> = new Set();
const seenUnknownTypes: Set<string> = new Set();

const listeners = new Set<() => void>();

function notify() {
  updateSnapshot();
  for (const listener of listeners) listener();
}

// ── Public API ────────────────────────────────────────────────────

export function pushEntries(raw: unknown[]) {
  let changed = false;
  const now = Date.now();
  let latestSceneIdInBatch: number | null = null;

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const type = e.type as string;

    if (type === 'crdt') {
      totalCrdt++;
      const crdt = e as unknown as CrdtEntry;
      applyCrdtEntry(crdt);

      // Track tick per scene
      let sceneTicks = perSceneTicks.get(crdt.sid);
      if (!sceneTicks) {
        sceneTicks = { maxTick: 0, tickSet: new Set() };
        perSceneTicks.set(crdt.sid, sceneTicks);
      }
      if (crdt.tk > sceneTicks.maxTick) sceneTicks.maxTick = crdt.tk;
      if (!sceneTicks.tickSet.has(crdt.tk)) {
        sceneTicks.tickSet.add(crdt.tk);
        if (sceneTicks.tickSet.size > MAX_TICK_SET) {
          const oldest = sceneTicks.tickSet.values().next().value;
          if (oldest !== undefined) sceneTicks.tickSet.delete(oldest);
        }
      }
      if (crdt.sid) latestSceneIdInBatch = crdt.sid;

      // Track scene from sid
      if (crdt.sid && !knownScenes.has(crdt.sid)) {
        knownScenes.set(crdt.sid, {
          sceneId: crdt.sid,
          title: `Scene ${crdt.sid}`,
          baseParcel: '',
        });
      }

      // Update highlighting timestamps
      entityUpdateTimes[crdt.e] = now;
      componentUpdateTimes[`${crdt.e}:${crdt.c}`] = now;

      // Buffer for reconstruction
      allCrdtEntries.push(crdt);
      if (allCrdtEntries.length > MAX_ALL_CRDT) {
        allCrdtEntries = allCrdtEntries.slice(-MAX_ALL_CRDT);
      }

      changed = true;
    } else if (type === 'perf') {
      latestPerf = e as unknown as PerfSnapshot;
      perfHistory.push(latestPerf);
      if (perfHistory.length > MAX_PERF_HISTORY) perfHistory.shift();
      changed = true;
    } else if (type === 'op_call_start') {
      totalOps++;
      const opName = (e.op_name as string) ?? '';
      const lc = opName.toLowerCase();
      const isError = lc.includes('error') || lc.includes('warn');
      const isLog = lc.includes('log') || lc.includes('print');
      if (isLog || isError) {
        totalConsole++;
        const message = formatArgs(e.args);
        const tsRaw = e.timestamp_ms;
        const sceneId = latestSceneIdInBatch;
        const sceneTick = sceneId != null ? (perSceneTicks.get(sceneId)?.maxTick ?? null) : null;
        consoleEntries = [
          ...consoleEntries,
          {
            timestamp: typeof tsRaw === 'number' ? tsRaw : Date.now(),
            tick: sceneTick,
            sceneId,
            level: isError ? 'error' : 'log',
            message,
          },
        ];
        if (consoleEntries.length > MAX_CONSOLE)
          consoleEntries = consoleEntries.slice(-MAX_CONSOLE);
        changed = true;
      } else if (!seenUnknownOps.has(opName)) {
        seenUnknownOps.add(opName);
        // eslint-disable-next-line no-console
        console.debug('[mobile-debug-store] unknown op_call_start op_name:', opName);
      }
    } else if (type === 'scene_lifecycle') {
      // Extract scene info from SceneInit events
      const event = e.event as string;
      const sceneId = e.scene_id as number;
      if (event === 'scene_init' && sceneId != null) {
        const title = (e.title as string) || `Scene ${sceneId}`;
        const baseParcel = (e.base_parcel as string) || '';
        knownScenes.set(sceneId, { sceneId, title, baseParcel });
        changed = true;
      }
    } else if (type && !seenUnknownTypes.has(type)) {
      seenUnknownTypes.add(type);
      // eslint-disable-next-line no-console
      console.debug('[mobile-debug-store] unknown entry type:', type, e);
    }
  }

  if (changed) notify();
}

export function updateSessions(s: MobileDebugSessionInfo[]) {
  sessions = s;
  notify();
}

export function setIsPaused(paused: boolean) {
  isPaused = paused;
  notify();
}

export function setRemoteStatus(status: RemoteStatus) {
  remoteStatus = status;
  isPaused = status.paused;
  notify();
}

export function clear() {
  entities = {};
  entityChanges = {};
  consoleEntries = [];
  latestPerf = null;
  perfHistory = [];
  totalCrdt = 0;
  totalOps = 0;
  totalConsole = 0;
  isPaused = false;
  remoteStatus = null;
  knownScenes = new Map();
  perSceneTicks = new Map();
  entityUpdateTimes = {};
  componentUpdateTimes = {};
  allCrdtEntries = [];
  notify();
}

export const reset = clear;

// ── Selectors ─────────────────────────────────────────────────────

export function getEntities(): Record<number, EntityState> {
  return entities;
}
export function getEntityChanges(eid: number): CrdtEntry[] {
  return entityChanges[eid] ?? [];
}
export function getConsoleEntries(): ConsoleEntry[] {
  return consoleEntries;
}
export function getSessions(): MobileDebugSessionInfo[] {
  return sessions;
}
export function getLatestPerf(): PerfSnapshot | null {
  return latestPerf;
}
export function getPerfHistory(): PerfSnapshot[] {
  return perfHistory;
}
export function getIsPaused(): boolean {
  return isPaused;
}
export function getRemoteStatus(): RemoteStatus | null {
  return remoteStatus;
}
export function getKnownScenes(): SceneInfo[] {
  return Array.from(knownScenes.values());
}
export function getSceneTickInfo(sceneId: number): SceneTickInfo {
  const info = perSceneTicks.get(sceneId);
  return {
    maxTick: info?.maxTick ?? 0,
    tickCount: info?.tickSet.size ?? 0,
  };
}
export function getAllSceneTickInfo(): Record<number, SceneTickInfo> {
  const out: Record<number, SceneTickInfo> = {};
  for (const [sid, info] of perSceneTicks) {
    out[sid] = { maxTick: info.maxTick, tickCount: info.tickSet.size };
  }
  return out;
}
export function getEntityUpdateTime(eid: number): number {
  return entityUpdateTimes[eid] ?? 0;
}
export function getComponentUpdateTime(eid: number, comp: string): number {
  return componentUpdateTimes[`${eid}:${comp}`] ?? 0;
}
export function getStats(sceneId?: number) {
  let tickCount = 0;
  if (sceneId != null) {
    tickCount = perSceneTicks.get(sceneId)?.tickSet.size ?? 0;
  } else {
    for (const info of perSceneTicks.values()) tickCount += info.tickSet.size;
  }
  return { totalCrdt, totalOps, totalConsole, sessions: sessions.length, tickCount };
}

/**
 * Get CRDT entries at a specific tick for a given scene.
 */
export function getEntriesAtTick(tick: number, sceneId: number): CrdtEntry[] {
  return allCrdtEntries.filter(e => e.tk === tick && e.sid === sceneId);
}

/**
 * Reconstruct the full entity state by replaying all CRDT operations up to targetTick
 * for the given scene. Returns `truncated: true` when targetTick is older than the
 * oldest buffered tick (meaning some history has been evicted and the state is partial).
 */
export function reconstructStateAtTick(targetTick: number, sceneId: number): ReconstructResult {
  const state: Record<number, EntityState> = {};
  let oldestAvailableTick: number | null = null;
  for (const entry of allCrdtEntries) {
    if (entry.sid !== sceneId) continue;
    if (oldestAvailableTick === null || entry.tk < oldestAvailableTick) {
      oldestAvailableTick = entry.tk;
    }
    if (entry.tk > targetTick) continue;
    applyToState(state, entry);
  }
  const truncated = oldestAvailableTick !== null && targetTick < oldestAvailableTick;
  return { state, truncated, oldestAvailableTick };
}

// ── Snapshot ─────────────────────────────────────────────────────

// useSyncExternalStore compatible — cached to maintain referential equality
interface MobileDebugSnapshot {
  entities: Record<number, EntityState>;
  consoleEntries: ConsoleEntry[];
  sessions: MobileDebugSessionInfo[];
  latestPerf: PerfSnapshot | null;
  perfHistory: PerfSnapshot[];
  totalCrdt: number;
  totalOps: number;
  totalConsole: number;
  isPaused: boolean;
  remoteStatus: RemoteStatus | null;
  knownScenes: SceneInfo[];
  sceneTicks: Record<number, SceneTickInfo>;
}

let cachedSnapshot: MobileDebugSnapshot = {
  entities: { ...entities },
  consoleEntries,
  sessions,
  latestPerf,
  perfHistory,
  totalCrdt,
  totalOps,
  totalConsole,
  isPaused,
  remoteStatus,
  knownScenes: [],
  sceneTicks: {},
};

function updateSnapshot() {
  cachedSnapshot = {
    entities: { ...entities },
    consoleEntries,
    sessions,
    latestPerf,
    perfHistory,
    totalCrdt,
    totalOps,
    totalConsole,
    isPaused,
    remoteStatus,
    knownScenes: Array.from(knownScenes.values()),
    sceneTicks: getAllSceneTickInfo(),
  };
}

export function getSnapshot() {
  return cachedSnapshot;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── CRDT State Machine ───────────────────────────────────────────

function applyToState(state: Record<number, EntityState>, entry: CrdtEntry) {
  const eid = entry.e;
  const op = entry.op;
  const comp = entry.c;

  if (op === 'de') {
    delete state[eid];
    return;
  }

  if (!state[eid]) {
    state[eid] = { components: {}, parent: 0 };
  }
  const ent = state[eid];

  if (op === 'd') {
    delete ent.components[comp];
  } else if (op === 'a') {
    if (!Array.isArray(ent.components[comp])) {
      ent.components[comp] = [];
    }
    const arr = ent.components[comp] as unknown[];
    arr.push(entry.payload ?? {});
    if (arr.length > GOS_LIMIT) arr.shift();
  } else {
    // put (LWW)
    ent.components[comp] = entry.payload ?? true;
    if (comp === 'Transform' && entry.payload && typeof entry.payload === 'object') {
      const p = (entry.payload as Record<string, unknown>).parent;
      if (typeof p === 'number') ent.parent = p;
    }
    if (comp === 'UiTransform' && entry.payload && typeof entry.payload === 'object') {
      const payload = entry.payload as Record<string, unknown>;
      const p = (payload.parent ?? payload.parent_entity ?? 0) as number;
      ent.parent = p;
    }
  }
}

function applyCrdtEntry(entry: CrdtEntry) {
  const eid = entry.e;
  const comp = entry.c;

  // Detach the touched entity from the published snapshot once per batch.
  // `cachedSnapshot.entities` is the last shallow-cloned outer map exposed to
  // React; if the entity we are about to mutate still shares its reference with
  // that snapshot, clone it so the previous snapshot stays frozen. Subsequent
  // mutations to the same entity within the same batch hit the already-detached
  // copy and skip the clone. The outer map is cloned exactly once per batch in
  // `updateSnapshot()` when `notify()` fires at the end of `pushEntries()`.
  const existing = entities[eid];
  if (existing && existing === cachedSnapshot.entities[eid]) {
    entities[eid] = { components: { ...existing.components }, parent: existing.parent };
  }

  if (entry.op === 'de') {
    delete entities[eid];
    delete entityUpdateTimes[eid];
    const prefix = `${eid}:`;
    for (const key of Object.keys(componentUpdateTimes)) {
      if (key.startsWith(prefix)) delete componentUpdateTimes[key];
    }
  } else {
    if (!entities[eid]) entities[eid] = { components: {}, parent: 0 };
    applyToState(entities, entry);
    if (entry.op === 'd') {
      delete componentUpdateTimes[`${eid}:${comp}`];
    }
  }

  if (entry.op !== 'de') {
    if (!entityChanges[eid]) entityChanges[eid] = [];
    const changes = entityChanges[eid];
    changes.push(entry);
    if (changes.length > MAX_CHANGES_PER_ENTITY) changes.shift();
  } else {
    delete entityChanges[eid];
  }

  maybePruneUpdateTimes();
}

let updateTimesTicker = 0;
function maybePruneUpdateTimes() {
  updateTimesTicker++;
  if (updateTimesTicker < 1024) return;
  updateTimesTicker = 0;
  const cutoff = Date.now() - UPDATE_TIME_TTL_MS;
  for (const key of Object.keys(entityUpdateTimes)) {
    if (entityUpdateTimes[Number(key)] < cutoff) delete entityUpdateTimes[Number(key)];
  }
  for (const key of Object.keys(componentUpdateTimes)) {
    if (componentUpdateTimes[key] < cutoff) delete componentUpdateTimes[key];
  }
}

function formatArgs(args: unknown): string {
  if (args == null) return '';
  if (Array.isArray(args))
    return args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  if (typeof args === 'string') return args;
  return JSON.stringify(args);
}
