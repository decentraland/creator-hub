import React, {
  useState,
  useSyncExternalStore,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import * as sceneLogStore from '../../../lib/logic/scene-log-store';
import type { CrdtEntry, PerfSnapshot, SceneInfo } from '../../../lib/logic/scene-log-store';
import { getSceneClient } from '../../../lib/rpc/scene';

import './MobileSession.css';

enum SubTab {
  EntityTree = 'EntityTree',
  Console = 'Console',
  Monitor = 'Monitor',
}

function useSceneLogCommand() {
  return useCallback(async (cmd: string, args: Record<string, unknown> = {}) => {
    const client = getSceneClient();
    if (!client) return null;
    try {
      return await client.broadcastSceneLogCommand(cmd, args);
    } catch {
      return null;
    }
  }, []);
}

// ── Command Toolbar ──────────────────────────────────────────────

function CommandToolbar({ isPaused, hasSession }: { isPaused: boolean; hasSession: boolean }) {
  const sendCommand = useSceneLogCommand();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCommand = useCallback(
    async (cmd: string, args: Record<string, unknown> = {}) => {
      setLoading(cmd);
      const result = await sendCommand(cmd, args);
      if (result?.ok && (cmd === 'pause' || cmd === 'resume')) {
        sceneLogStore.setIsPaused(cmd === 'pause');
      }
      setLoading(null);
    },
    [sendCommand],
  );

  if (!hasSession) return null;

  return (
    <div className="MobileSession-toolbar">
      <button
        className={`MobileSession-cmd ${isPaused ? 'paused' : ''}`}
        onClick={() => handleCommand(isPaused ? 'resume' : 'pause')}
        disabled={loading !== null}
        title={isPaused ? 'Resume scene' : 'Pause scene'}
      >
        {isPaused ? '\u25B6' : '\u23F8'}
      </button>
      <button
        className="MobileSession-cmd"
        onClick={() => handleCommand('reload_scene')}
        disabled={loading !== null}
        title="Reload scene"
      >
        {'\u21BB'}
      </button>
      {isPaused && <span className="MobileSession-pausedBadge">PAUSED</span>}
    </div>
  );
}

// ── Tick Inspector Bar ───────────────────────────────────────────

interface TickBarProps {
  maxTick: number;
  selectedTick: number | null;
  onSelectTick: (tick: number | null) => void;
  onReconstruct: () => void;
  isReconstructed: boolean;
}

function TickBar({
  maxTick,
  selectedTick,
  onSelectTick,
  onReconstruct,
  isReconstructed,
}: TickBarProps) {
  const [inputValue, setInputValue] = useState('');

  const handleClear = useCallback(() => {
    onSelectTick(null);
    setInputValue('');
  }, [onSelectTick]);

  return (
    <div className="TickBar">
      <span className="TickBar-label">Tick:</span>
      <input
        className="TickBar-input"
        type="number"
        min={0}
        max={maxTick}
        placeholder={`max ${maxTick}`}
        value={selectedTick != null ? selectedTick : inputValue}
        onChange={e => {
          setInputValue(e.target.value);
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= 0) onSelectTick(n);
        }}
      />
      {selectedTick != null && (
        <>
          <button
            className="TickBar-btn"
            onClick={onReconstruct}
            title="Reconstruct entity state at this tick"
          >
            {isReconstructed ? 'Viewing tick ' + selectedTick : 'Reconstruct'}
          </button>
          <button
            className="TickBar-btn TickBar-clear"
            onClick={handleClear}
            title="Back to live"
          >
            Live
          </button>
        </>
      )}
    </div>
  );
}

// ── Session Badge ────────────────────────────────────────────────

function SessionBadge({ sessions }: { sessions: sceneLogStore.SessionInfo[] }) {
  if (sessions.length === 0) {
    return <span className="MobileSession-waiting">No session</span>;
  }
  return (
    <div className="MobileSession-sessionBadges">
      {sessions.map(s => {
        const shortId = s.sessionId ? s.sessionId.slice(0, 4) : `#${s.id}`;
        return (
          <span
            key={s.id}
            className="MobileSession-sessionChip"
          >
            {s.deviceName ? `${s.deviceName} - ` : ''}
            Session {shortId}{' '}
            <span className={`MobileSession-badge ${s.status}`}>
              {s.status === 'active' ? 'Active' : 'Ended'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

function MobileSession() {
  const [subTab, setSubTab] = useState(SubTab.EntityTree);
  const snapshot = useSyncExternalStore(sceneLogStore.subscribe, sceneLogStore.getSnapshot);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [reconstructedEntities, setReconstructedEntities] = useState<Record<
    number,
    { components: Record<string, unknown>; parent: number }
  > | null>(null);

  // Auto-select first scene when scenes appear
  useEffect(() => {
    if (selectedSceneId == null && snapshot.knownScenes.length > 0) {
      setSelectedSceneId(snapshot.knownScenes[0].sceneId);
    }
  }, [snapshot.knownScenes, selectedSceneId]);

  const handleReconstruct = useCallback(() => {
    if (selectedTick != null) {
      setReconstructedEntities(sceneLogStore.reconstructStateAtTick(selectedTick));
    }
  }, [selectedTick]);

  const handleSelectTick = useCallback((tick: number | null) => {
    setSelectedTick(tick);
    if (tick == null) setReconstructedEntities(null);
  }, []);

  const displayEntities = useMemo(() => {
    return reconstructedEntities ?? snapshot.entities;
  }, [reconstructedEntities, snapshot.entities]);

  const stats = sceneLogStore.getStats();
  const hasActiveSession = snapshot.sessions.some(s => s.status === 'active');

  return (
    <div className="MobileSession">
      {/* Tabs + toolbar + session/scene + stats — single row */}
      <div className="MobileSession-tabs">
        {Object.values(SubTab).map(t => (
          <div
            key={t}
            className={`MobileSession-tab ${subTab === t ? 'active' : ''}`}
            onClick={() => setSubTab(t)}
          >
            {t === SubTab.EntityTree ? 'ENTITY TREE' : t === SubTab.Console ? 'CONSOLE' : 'MONITOR'}
          </div>
        ))}
        <CommandToolbar
          isPaused={snapshot.isPaused}
          hasSession={hasActiveSession}
        />
        <div className="MobileSession-right">
          <div className="MobileSession-stats">
            <span>{snapshot.totalCrdt.toLocaleString()} CRDT</span>
            <span>{stats.tickCount.toLocaleString()} ticks</span>
          </div>
          {snapshot.knownScenes.length > 1 ? (
            <select
              className="MobileSession-sceneSelect"
              value={selectedSceneId ?? ''}
              onChange={e => setSelectedSceneId(e.target.value ? Number(e.target.value) : null)}
            >
              {snapshot.knownScenes.map(sc => (
                <option
                  key={sc.sceneId}
                  value={sc.sceneId}
                >
                  {sc.baseParcel ? `${sc.baseParcel} ` : ''}
                  {sc.title}
                </option>
              ))}
            </select>
          ) : snapshot.knownScenes.length === 1 ? (
            <span className="MobileSession-sceneLabel">
              {snapshot.knownScenes[0].baseParcel ? `${snapshot.knownScenes[0].baseParcel} ` : ''}
              {snapshot.knownScenes[0].title}
            </span>
          ) : null}
          <SessionBadge sessions={snapshot.sessions} />
        </div>
      </div>

      {/* Tick inspector */}
      {subTab === SubTab.EntityTree && (
        <TickBar
          maxTick={snapshot.maxTick}
          selectedTick={selectedTick}
          onSelectTick={handleSelectTick}
          onReconstruct={handleReconstruct}
          isReconstructed={reconstructedEntities != null}
        />
      )}

      {/* Content */}
      <div className="MobileSession-content">
        {subTab === SubTab.EntityTree && (
          <EntityTreeView
            entities={displayEntities}
            selectedTick={selectedTick}
            isReconstructed={reconstructedEntities != null}
          />
        )}
        {subTab === SubTab.Console && <ConsoleView entries={snapshot.consoleEntries} />}
        {subTab === SubTab.Monitor && (
          <MonitorView
            perf={snapshot.latestPerf}
            perfHistory={snapshot.perfHistory}
            stats={stats}
          />
        )}
      </div>
    </div>
  );
}

// ── Entity Tree ────────────────────────────────────────────────

interface EntityTreeViewProps {
  entities: Record<number, { components: Record<string, unknown>; parent: number }>;
  selectedTick: number | null;
  isReconstructed: boolean;
}

function EntityTreeView({ entities, selectedTick, isReconstructed }: EntityTreeViewProps) {
  const [selectedEid, setSelectedEid] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [, setRenderTick] = useState(0);

  // Re-render periodically to fade out highlights
  useEffect(() => {
    const interval = setInterval(() => setRenderTick(t => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  const tickEntries = useMemo(() => {
    if (selectedTick == null || isReconstructed) return null;
    return sceneLogStore.getEntriesAtTick(selectedTick);
  }, [selectedTick, isReconstructed]);

  const tickEntityIds = useMemo(() => {
    if (!tickEntries) return null;
    return new Set(tickEntries.map(e => e.e));
  }, [tickEntries]);

  const eids = Object.keys(entities)
    .map(Number)
    .sort((a, b) => a - b);

  const childrenMap: Record<number, number[]> = {};
  for (const eid of eids) {
    const parent = entities[eid].parent;
    if (parent === eid) continue;
    if (!childrenMap[parent]) childrenMap[parent] = [];
    childrenMap[parent].push(eid);
  }

  const roots = eids.filter(eid => {
    const parent = entities[eid].parent;
    return parent === eid || !(parent in entities);
  });

  const matchesFilter = (eid: number): boolean => {
    if (tickEntityIds && !tickEntityIds.has(eid)) return false;
    if (!filter) return true;
    const f = filter.toLowerCase();
    if (String(eid).includes(f)) return true;
    return Object.keys(entities[eid].components).some(c => c.toLowerCase().includes(f));
  };

  // When filtering, show flat list of all matching entities (skip tree hierarchy)
  const isFiltering = !!filter || !!tickEntityIds;
  const filteredEids = isFiltering ? eids.filter(matchesFilter) : [];

  return (
    <div className="EntityTree">
      <div className="EntityTree-toolbar">
        <input
          className="EntityTree-filter"
          placeholder="Filter by entity ID or component..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <span className="EntityTree-count">
          {tickEntityIds
            ? `${tickEntityIds.size} at tick ${selectedTick}`
            : filter
              ? `${filteredEids.length} matching`
              : `${eids.length} entities`}
        </span>
      </div>
      <div className="EntityTree-split">
        <div className="EntityTree-list">
          {isFiltering
            ? filteredEids.map(eid => (
                <EntityNode
                  key={eid}
                  eid={eid}
                  entities={entities}
                  childrenMap={{}}
                  depth={0}
                  selectedEid={selectedEid}
                  onSelect={setSelectedEid}
                  matchesFilter={() => true}
                />
              ))
            : roots.map(eid => (
                <EntityNode
                  key={eid}
                  eid={eid}
                  entities={entities}
                  childrenMap={childrenMap}
                  depth={0}
                  selectedEid={selectedEid}
                  onSelect={setSelectedEid}
                  matchesFilter={() => true}
                />
              ))}
        </div>
        <div className="EntityTree-detail">
          {selectedEid !== null && entities[selectedEid] ? (
            <EntityDetail
              eid={selectedEid}
              entity={entities[selectedEid]}
            />
          ) : (
            <div className="EntityTree-placeholder">Select an entity</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EntityNodeProps {
  eid: number;
  entities: Record<number, { components: Record<string, unknown>; parent: number }>;
  childrenMap: Record<number, number[]>;
  depth: number;
  selectedEid: number | null;
  onSelect: (eid: number) => void;
  matchesFilter: (eid: number) => boolean;
}

function EntityNode({
  eid,
  entities,
  childrenMap,
  depth,
  selectedEid,
  onSelect,
  matchesFilter,
}: EntityNodeProps) {
  const [expanded, setExpanded] = useState(true);
  if (!matchesFilter(eid)) return null;

  const ent = entities[eid];
  const children = childrenMap[eid] ?? [];
  const compNames = Object.keys(ent.components).sort().join(', ');
  const hasChildren = children.length > 0;

  const lastUpdate = sceneLogStore.getEntityUpdateTime(eid);
  const elapsed = Date.now() - lastUpdate;
  const isRecent = lastUpdate > 0 && elapsed < 1000;
  const highlightOpacity = isRecent ? Math.max(0, 1 - elapsed / 1000) : 0;

  return (
    <>
      <div
        className={`EntityNode ${selectedEid === eid ? 'selected' : ''}`}
        style={{
          paddingLeft: `${depth * 16 + 4}px`,
          background:
            highlightOpacity > 0
              ? `rgba(46,204,113,${(highlightOpacity * 0.3).toFixed(2)})`
              : undefined,
        }}
        onClick={() => onSelect(eid)}
      >
        {hasChildren && (
          <span
            className="EntityNode-toggle"
            onClick={e => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
        )}
        {!hasChildren && <span className="EntityNode-toggle" />}
        <span className="EntityNode-id">{eid}</span>
        <span className="EntityNode-components">{compNames}</span>
      </div>
      {expanded &&
        children.map(childEid => (
          <EntityNode
            key={childEid}
            eid={childEid}
            entities={entities}
            childrenMap={childrenMap}
            depth={depth + 1}
            selectedEid={selectedEid}
            onSelect={onSelect}
            matchesFilter={matchesFilter}
          />
        ))}
    </>
  );
}

function EntityDetail({
  eid,
  entity,
}: {
  eid: number;
  entity: { components: Record<string, unknown>; parent: number };
}) {
  const changes = sceneLogStore.getEntityChanges(eid);
  const compNames = Object.keys(entity.components).sort();

  return (
    <div className="EntityDetail">
      <div className="EntityDetail-header">
        Entity {eid} · parent={entity.parent} · {compNames.length} components
      </div>
      <div className="EntityDetail-components">
        {compNames.map(name => {
          const value = entity.components[name];
          const preview = Array.isArray(value)
            ? `[GOS: ${value.length} items]`
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value).slice(0, 200)
              : String(value);

          const lastUpdate = sceneLogStore.getComponentUpdateTime(eid, name);
          const elapsed = Date.now() - lastUpdate;
          const isRecent = lastUpdate > 0 && elapsed < 1000;
          const highlightOpacity = isRecent ? Math.max(0, 1 - elapsed / 1000) : 0;

          return (
            <div
              key={name}
              className="EntityDetail-comp"
              style={
                highlightOpacity > 0
                  ? { background: `rgba(46,204,113,${(highlightOpacity * 0.2).toFixed(2)})` }
                  : undefined
              }
            >
              <span className="EntityDetail-compName">{name}</span>
              <span className="EntityDetail-compValue">{preview}</span>
            </div>
          );
        })}
      </div>
      <div className="EntityDetail-changesHeader">Changes ({changes.length})</div>
      <div className="EntityDetail-changes">
        {changes.slice(-100).map((ch, i) => (
          <div
            key={i}
            className={`EntityDetail-change dir-${ch.d}`}
          >
            <span className="ch-tick">[{ch.tk}]</span>
            <span className={`ch-op op-${ch.op}`}>
              {ch.op === 'p'
                ? 'PUT'
                : ch.op === 'd'
                  ? 'DEL'
                  : ch.op === 'a'
                    ? 'APP'
                    : ch.op.toUpperCase()}
            </span>
            <span className="ch-comp">{ch.c}</span>
            <span className="ch-dir">{ch.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Console ────────────────────────────────────────────────────

function ConsoleView({ entries }: { entries: sceneLogStore.ConsoleEntry[] }) {
  const [textFilter, setTextFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'log' | 'error'>('all');

  const filtered = useMemo(() => {
    let result = entries;
    if (levelFilter !== 'all') {
      result = result.filter(e => e.level === levelFilter);
    }
    if (textFilter) {
      const f = textFilter.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(f));
    }
    return result;
  }, [entries, levelFilter, textFilter]);

  return (
    <div className="SceneConsole">
      <div className="SceneConsole-entries">
        {filtered.length === 0 ? (
          <div className="SceneConsole-empty">
            {entries.length === 0 ? 'No console output yet...' : 'No entries match filter'}
          </div>
        ) : (
          filtered.map((e, i) => (
            <div
              key={i}
              className={`SceneConsole-line ${e.level}`}
            >
              <span className="SceneConsole-time">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <span className="SceneConsole-tick">[{e.tick}]</span>
              <span className="SceneConsole-msg">{e.message}</span>
            </div>
          ))
        )}
      </div>
      <div className="SceneConsole-filterBar">
        <input
          className="SceneConsole-filterInput"
          placeholder="Filter..."
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
        />
        <button
          className={`SceneConsole-levelBtn ${levelFilter === 'all' ? 'active' : ''}`}
          onClick={() => setLevelFilter('all')}
        >
          ALL
        </button>
        <button
          className={`SceneConsole-levelBtn ${levelFilter === 'log' ? 'active' : ''}`}
          onClick={() => setLevelFilter('log')}
        >
          LOG
        </button>
        <button
          className={`SceneConsole-levelBtn ${levelFilter === 'error' ? 'active' : ''}`}
          onClick={() => setLevelFilter('error')}
        >
          ERROR
        </button>
        <span className="SceneConsole-filterCount">
          {filtered.length}/{entries.length}
        </span>
      </div>
    </div>
  );
}

// ── Monitor ────────────────────────────────────────────────────

function fmt(n: number, decimals = 1): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(decimals) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(decimals) + 'K';
  return decimals > 0 ? n.toFixed(decimals) : String(n);
}

function MetricRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="SceneMonitor-row">
      <span className="SceneMonitor-rowLabel">{label}</span>
      <span className="SceneMonitor-rowValue">
        {value}
        {unit ? <span className="SceneMonitor-unit">{unit}</span> : null}
      </span>
    </div>
  );
}

function FpsSparkline({ history }: { history: PerfSnapshot[] }) {
  if (history.length < 2) return null;
  const values = history.map(h => h.fps);
  const max = Math.max(...values, 1);
  return (
    <div className="SceneMonitor-sparkline">
      {values.map((v, i) => (
        <div
          key={i}
          className="SceneMonitor-bar"
          style={{ height: `${(v / max) * 100}%` }}
          title={`${v.toFixed(1)} FPS`}
        />
      ))}
    </div>
  );
}

interface MonitorViewProps {
  perf: PerfSnapshot | null;
  perfHistory: PerfSnapshot[];
  stats: ReturnType<typeof sceneLogStore.getStats>;
}

function MonitorView({ perf, perfHistory, stats }: MonitorViewProps) {
  if (!perf) {
    return (
      <div className="SceneMonitor">
        <div className="SceneMonitor-empty">Waiting for performance data...</div>
      </div>
    );
  }

  return (
    <div className="SceneMonitor">
      <div className="SceneMonitor-grid">
        <div className="SceneMonitor-card">
          <div className="SceneMonitor-cardTitle">Rendering</div>
          <MetricRow
            label="FPS"
            value={fmt(perf.fps)}
          />
          <MetricRow
            label="Draw Calls"
            value={fmt(perf.draw_calls, 0)}
          />
          <MetricRow
            label="Primitives"
            value={fmt(perf.primitives, 0)}
          />
          <MetricRow
            label="Objects"
            value={fmt(perf.objects_in_frame, 0)}
          />
        </div>
        <div className="SceneMonitor-card">
          <div className="SceneMonitor-cardTitle">Memory</div>
          <MetricRow
            label="Godot Static"
            value={fmt(perf.mem_static_mb)}
            unit="MB"
          />
          <MetricRow
            label="GPU VRAM"
            value={fmt(perf.mem_gpu_mb)}
            unit="MB"
          />
          {perf.mem_rust_mb > 0 && (
            <MetricRow
              label="Rust Heap"
              value={fmt(perf.mem_rust_mb)}
              unit="MB"
            />
          )}
        </div>
        <div className="SceneMonitor-card">
          <div className="SceneMonitor-cardTitle">JavaScript</div>
          <MetricRow
            label="Heap Used"
            value={fmt(perf.js_heap_used_mb)}
            unit="MB"
          />
          <MetricRow
            label="Heap Total"
            value={fmt(perf.js_heap_total_mb)}
            unit="MB"
          />
          <MetricRow
            label="Heap Limit"
            value={fmt(perf.js_heap_limit_mb)}
            unit="MB"
          />
          <MetricRow
            label="External"
            value={fmt(perf.js_external_mb)}
            unit="MB"
          />
          <MetricRow
            label="Scenes"
            value={String(perf.scene_count)}
          />
        </div>
        <div className="SceneMonitor-card">
          <div className="SceneMonitor-cardTitle">Assets</div>
          <MetricRow
            label="Loading"
            value={String(perf.assets_loading)}
          />
          <MetricRow
            label="Loaded"
            value={perf.assets_loaded.toLocaleString()}
          />
          <MetricRow
            label="Download"
            value={fmt(perf.download_speed_mbs)}
            unit="MB/s"
          />
        </div>
      </div>
      <div className="SceneMonitor-section">
        <div className="SceneMonitor-cardTitle">FPS History</div>
        <FpsSparkline history={perfHistory} />
      </div>
      <div className="SceneMonitor-footer">
        <span>{stats.totalCrdt.toLocaleString()} CRDT</span>
        <span>{stats.tickCount.toLocaleString()} ticks</span>
        <span>{stats.totalOps.toLocaleString()} Ops</span>
        <span>{stats.totalConsole.toLocaleString()} Logs</span>
        <span>
          {stats.sessions} Session{stats.sessions !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default React.memo(MobileSession);
