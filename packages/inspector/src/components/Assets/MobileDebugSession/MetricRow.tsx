import React from 'react';

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

export default MetricRow;
