/**
 * External store for scene log entries received from mobile sessions.
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
  tick: number;
  level: 'log' | 'error';
  message: string;
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

export interface SessionInfo {
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
  scene_logging_active: boolean;
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
let sessions: SessionInfo[] = [];
let latestPerf: PerfSnapshot | null = null;
let perfHistory: PerfSnapshot[] = [];
let totalCrdt = 0;
let totalOps = 0;
let totalConsole = 0;
let isPaused = false;
let remoteStatus: RemoteStatus | null = null;

// Scene tracking
let knownScenes: Map<number, SceneInfo> = new Map();

// Tick tracking
let maxTick = 0;
let tickSet: Set<number> = new Set();

// Update highlighting: entity_id → timestamp of last update
let entityUpdateTimes: Record<number, number> = {};
// Component-level: `${entity_id}:${component_name}` → timestamp
let componentUpdateTimes: Record<string, number> = {};

// Full CRDT log for reconstruction
let allCrdtEntries: CrdtEntry[] = [];

const listeners = new Set<() => void>();

function notify() {
  updateSnapshot();
  for (const listener of listeners) listener();
}

// ── Public API ────────────────────────────────────────────────────

export function pushEntries(raw: unknown[]) {
  let changed = false;
  const now = Date.now();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const type = e.type as string;

    if (type === 'crdt') {
      totalCrdt++;
      const crdt = e as unknown as CrdtEntry;
      applyCrdtEntry(crdt);

      // Track tick
      if (crdt.tk > maxTick) maxTick = crdt.tk;
      if (!tickSet.has(crdt.tk)) {
        tickSet.add(crdt.tk);
        if (tickSet.size > MAX_TICK_SET) {
          const oldest = tickSet.values().next().value;
          if (oldest !== undefined) tickSet.delete(oldest);
        }
      }

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
      const opName = e.op_name as string;
      if (opName === 'op_log' || opName === 'op_error') {
        totalConsole++;
        const args = e.args as unknown;
        const message = formatArgs(args);
        consoleEntries.push({
          timestamp: (e.timestamp_ms as number) || Date.now(),
          tick: maxTick,
          level: opName === 'op_error' ? 'error' : 'log',
          message,
        });
        if (consoleEntries.length > MAX_CONSOLE) consoleEntries.shift();
        changed = true;
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
    }
  }

  if (changed) notify();
}

export function updateSessions(s: SessionInfo[]) {
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
  maxTick = 0;
  tickSet = new Set();
  entityUpdateTimes = {};
  componentUpdateTimes = {};
  allCrdtEntries = [];
  notify();
}

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
export function getSessions(): SessionInfo[] {
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
export function getMaxTick(): number {
  return maxTick;
}
export function getTickCount(): number {
  return tickSet.size;
}
export function getEntityUpdateTime(eid: number): number {
  return entityUpdateTimes[eid] ?? 0;
}
export function getComponentUpdateTime(eid: number, comp: string): number {
  return componentUpdateTimes[`${eid}:${comp}`] ?? 0;
}
export function getStats() {
  return { totalCrdt, totalOps, totalConsole, sessions: sessions.length, tickCount: tickSet.size };
}

/**
 * Get CRDT entries at a specific tick (for tick inspection).
 */
export function getEntriesAtTick(tick: number): CrdtEntry[] {
  return allCrdtEntries.filter(e => e.tk === tick);
}

/**
 * Reconstruct the full entity state by replaying all CRDT operations up to targetTick.
 */
export function reconstructStateAtTick(targetTick: number): Record<number, EntityState> {
  const state: Record<number, EntityState> = {};
  for (const entry of allCrdtEntries) {
    if (entry.tk > targetTick) continue;
    applyToState(state, entry);
  }
  return state;
}

// ── Snapshot ─────────────────────────────────────────────────────

// useSyncExternalStore compatible — cached to maintain referential equality
let cachedSnapshot: {
  entities: Record<number, EntityState>;
  consoleEntries: ConsoleEntry[];
  sessions: SessionInfo[];
  latestPerf: PerfSnapshot | null;
  perfHistory: PerfSnapshot[];
  totalCrdt: number;
  totalOps: number;
  totalConsole: number;
  isPaused: boolean;
  remoteStatus: RemoteStatus | null;
  knownScenes: SceneInfo[];
  maxTick: number;
  tickCount: number;
} = {
  entities,
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
  maxTick,
  tickCount: 0,
};

function updateSnapshot() {
  cachedSnapshot = {
    entities,
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
    maxTick,
    tickCount: tickSet.size,
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

  // Shallow clone entities and the mutated entity so previous snapshots keep
  // referencing the prior state (useSyncExternalStore relies on referential
  // inequality to detect changes).
  entities = { ...entities };
  if (entry.op === 'de') {
    delete entities[eid];
    // Clean update-time entries for the deleted entity.
    delete entityUpdateTimes[eid];
    const prefix = `${eid}:`;
    for (const key of Object.keys(componentUpdateTimes)) {
      if (key.startsWith(prefix)) delete componentUpdateTimes[key];
    }
  } else {
    const existing = entities[eid];
    const cloned: EntityState = existing
      ? { components: { ...existing.components }, parent: existing.parent }
      : { components: {}, parent: 0 };
    entities[eid] = cloned;
    applyToState(entities, entry);
    if (entry.op === 'd') {
      delete componentUpdateTimes[`${eid}:${comp}`];
    }
  }

  // Track changes
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
