import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as sceneLogStore from '../../../lib/logic/scene-log-store';
import CommandToolbar from './CommandToolbar';
import TickBar from './TickBar';
import SessionBadge from './SessionBadge';
import EntityTreeView from './EntityTreeView';
import ConsoleView from './ConsoleView';
import MonitorView from './MonitorView';

import './MobileSession.css';

enum SubTab {
  EntityTree = 'EntityTree',
  Console = 'Console',
  Monitor = 'Monitor',
}

function MobileSession() {
  const [subTab, setSubTab] = useState(SubTab.EntityTree);
  const snapshot = useSyncExternalStore(sceneLogStore.subscribe, sceneLogStore.getSnapshot);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [reconstructedEntities, setReconstructedEntities] = useState<Record<
    number,
    { components: Record<string, unknown>; parent: number }
  > | null>(null);

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

      {subTab === SubTab.EntityTree && (
        <TickBar
          maxTick={snapshot.maxTick}
          selectedTick={selectedTick}
          onSelectTick={handleSelectTick}
          onReconstruct={handleReconstruct}
          isReconstructed={reconstructedEntities != null}
        />
      )}

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

export default React.memo(MobileSession);
