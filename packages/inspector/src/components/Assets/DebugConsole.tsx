import React, { useEffect, useRef, useSyncExternalStore } from 'react';

import { subscribe, getSnapshot, clear, type DebugLogEntry } from '../../lib/logic/debug-log-store';
import { useAppSelector } from '../../redux/hooks';
import { getDebugConsoleEnabled } from '../../redux/ui';

import './DebugConsole.css';

function DebugConsole() {
  const logs = useSyncExternalStore(subscribe, getSnapshot);
  const enabled = useAppSelector(getDebugConsoleEnabled);
  const logsRef = useRef<HTMLDivElement>(null);
  const prevLogCountRef = useRef(0);

  useEffect(() => {
    if (logs.length > prevLogCountRef.current && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
    prevLogCountRef.current = logs.length;
  }, [logs]);

  useEffect(() => {
    if (!enabled) {
      clear();
    }
  }, [enabled]);

  return (
    <div className="DebugConsole">
      <div
        className="DebugConsole-logs"
        ref={logsRef}
      >
        {logs.length > 0 ? (
          logs.map((entry: DebugLogEntry) => (
            <span
              key={entry.id}
              dangerouslySetInnerHTML={{ __html: entry.html }}
            />
          ))
        ) : (
          <div className="DebugConsole-placeholder">Run a scene to see debug output</div>
        )}
      </div>
    </div>
  );
}

export default React.memo(DebugConsole);
