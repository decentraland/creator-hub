import React from 'react';
import type { PerfSnapshot } from '../../../lib/logic/mobile-debug-store';
import * as mobileDebugStore from '../../../lib/logic/mobile-debug-store';
import MetricRow from './MetricRow';
import FpsSparkline from './FpsSparkline';
import { fmt } from './utils';

interface MonitorViewProps {
  perf: PerfSnapshot | null;
  perfHistory: PerfSnapshot[];
  stats: ReturnType<typeof mobileDebugStore.getStats>;
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

export default MonitorView;
