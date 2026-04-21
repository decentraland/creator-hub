import React, { useState } from 'react';
import * as mobileDebugStore from '../../../lib/logic/mobile-debug-store';

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
  const [expanded, setExpanded] = useState(depth === 0);
  if (!matchesFilter(eid)) return null;

  const ent = entities[eid];
  const children = childrenMap[eid] ?? [];
  const compNames = Object.keys(ent.components).sort().join(', ');
  const hasChildren = children.length > 0;

  const lastUpdate = mobileDebugStore.getEntityUpdateTime(eid);
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

export default EntityNode;
