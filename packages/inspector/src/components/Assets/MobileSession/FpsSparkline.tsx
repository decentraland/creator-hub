import React from 'react';
import type { PerfSnapshot } from '../../../lib/logic/scene-log-store';

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

export default FpsSparkline;
