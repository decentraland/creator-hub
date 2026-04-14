import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as mobileDebugStore from '../../../lib/logic/mobile-debug-store';
import CommandToolbar from './CommandToolbar';
import TickBar from './TickBar';
import SessionBadge from './SessionBadge';
import EntityTreeView from './EntityTreeView';
import ConsoleView from './ConsoleView';
import MonitorView from './MonitorView';

import './MobileDebugSession.css';

enum SubTab {
  EntityTree = 'EntityTree',
  Console = 'Console',
  Monitor = 'Monitor',
}

function MobileDebugSession() {
  const [subTab, setSubTab] = useState(SubTab.EntityTree);
  const snapshot = useSyncExternalStore(mobileDebugStore.subscribe, mobileDebugStore.getSnapshot);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [reconstruction, setReconstruction] = useState<mobileDebugStore.ReconstructResult | null>(
    null,
  );

  useEffect(() => {
    if (selectedSceneId == null && snapshot.knownScenes.length > 0) {
      setSelectedSceneId(snapshot.knownScenes[0].sceneId);
    }
  }, [snapshot.knownScenes, selectedSceneId]);

  const handleReconstruct = useCallback(() => {
    if (selectedTick != null && selectedSceneId != null) {
      setReconstruction(mobileDebugStore.reconstructStateAtTick(selectedTick, selectedSceneId));
    }
  }, [selectedTick, selectedSceneId]);

  const handleSelectTick = useCallback((tick: number | null) => {
    setSelectedTick(tick);
    if (tick == null) setReconstruction(null);
  }, []);

  const displayEntities = useMemo(() => {
    return reconstruction?.state ?? snapshot.entities;
  }, [reconstruction, snapshot.entities]);

  const sceneTickInfo = selectedSceneId != null ? snapshot.sceneTicks[selectedSceneId] : undefined;
  const sceneMaxTick = sceneTickInfo?.maxTick ?? 0;
  const stats = mobileDebugStore.getStats(selectedSceneId ?? undefined);
  const hasActiveSession = snapshot.sessions.some(s => s.status === 'active');

  return (
    <div className="MobileDebugSession">
      <div className="MobileDebugSession-tabs">
        {Object.values(SubTab).map(t => (
          <div
            key={t}
            className={`MobileDebugSession-tab ${subTab === t ? 'active' : ''}`}
            onClick={() => setSubTab(t)}
          >
            {t === SubTab.EntityTree ? 'ENTITY TREE' : t === SubTab.Console ? 'CONSOLE' : 'MONITOR'}
          </div>
        ))}
        <CommandToolbar
          isPaused={snapshot.isPaused}
          hasSession={hasActiveSession}
        />
        <div className="MobileDebugSession-right">
          <div className="MobileDebugSession-stats">
            <span>{snapshot.totalCrdt.toLocaleString()} CRDT</span>
            <span>{stats.tickCount.toLocaleString()} ticks</span>
          </div>
          {snapshot.knownScenes.length > 1 ? (
            <select
              className="MobileDebugSession-sceneSelect"
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
            <span className="MobileDebugSession-sceneLabel">
              {snapshot.knownScenes[0].baseParcel ? `${snapshot.knownScenes[0].baseParcel} ` : ''}
              {snapshot.knownScenes[0].title}
            </span>
          ) : null}
          <SessionBadge sessions={snapshot.sessions} />
        </div>
      </div>

      {subTab === SubTab.EntityTree && (
        <TickBar
          maxTick={sceneMaxTick}
          selectedTick={selectedTick}
          onSelectTick={handleSelectTick}
          onReconstruct={handleReconstruct}
          isReconstructed={reconstruction != null}
        />
      )}

      {reconstruction?.truncated && (
        <div className="MobileDebugSession-truncated">
          Showing partial scene — ticks before{' '}
          {reconstruction.oldestAvailableTick?.toLocaleString() ?? '?'} were dropped from the
          buffer.
        </div>
      )}

      <div className="MobileDebugSession-content">
        {subTab === SubTab.EntityTree && (
          <EntityTreeView
            entities={displayEntities}
            selectedTick={selectedTick}
            selectedSceneId={selectedSceneId}
            isReconstructed={reconstruction != null}
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

export default React.memo(MobileDebugSession);
