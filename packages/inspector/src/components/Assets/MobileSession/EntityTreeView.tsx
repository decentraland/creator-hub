import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as sceneLogStore from '../../../lib/logic/scene-log-store';
import EntityNode from './EntityNode';
import EntityDetail from './EntityDetail';

interface EntityTreeViewProps {
  entities: Record<number, { components: Record<string, unknown>; parent: number }>;
  selectedTick: number | null;
  isReconstructed: boolean;
}

function EntityTreeView({ entities, selectedTick, isReconstructed }: EntityTreeViewProps) {
  const [selectedEid, setSelectedEid] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [, setRenderTick] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const anyRecent = () => {
      const now = Date.now();
      for (const key of Object.keys(entities)) {
        const t = sceneLogStore.getEntityUpdateTime(Number(key));
        if (t > 0 && now - t < 1000) return true;
      }
      return false;
    };
    const tick = () => {
      if (!anyRecent()) {
        rafRef.current = null;
        return;
      }
      setRenderTick(t => t + 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (anyRecent() && rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [entities]);

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

export default EntityTreeView;
