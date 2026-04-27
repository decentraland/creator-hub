import React from 'react';
import * as mobileDebugStore from '../../../lib/logic/mobile-debug-store';

function EntityDetail({
  eid,
  entity,
}: {
  eid: number;
  entity: { components: Record<string, unknown>; parent: number };
}) {
  const changes = mobileDebugStore.getEntityChanges(eid);
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

          const lastUpdate = mobileDebugStore.getComponentUpdateTime(eid, name);
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

export default EntityDetail;
