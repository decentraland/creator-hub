import React, { useCallback, useEffect, useRef } from 'react';
import { AiOutlineDelete } from 'react-icons/ai';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getDebugConsoleLogs, clearDebugLogs } from '../../redux/ui';

import './DebugConsole.css';

function DebugConsole() {
  const dispatch = useAppDispatch();
  const logs = useAppSelector(getDebugConsoleLogs);
  const logsRef = useRef<HTMLDivElement>(null);
  const prevLogCountRef = useRef(0);

  useEffect(() => {
    if (logs.length > prevLogCountRef.current && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
    prevLogCountRef.current = logs.length;
  }, [logs.length]);

  const handleClear = useCallback(() => {
    dispatch(clearDebugLogs());
  }, [dispatch]);

  return (
    <div className="DebugConsole">
      <div className="DebugConsole-header">
        <span className="DebugConsole-title">Debug Console</span>
        <button
          className="DebugConsole-clear"
          onClick={handleClear}
          title="Clear logs"
        >
          <AiOutlineDelete />
        </button>
      </div>
      <div
        className="DebugConsole-logs"
        ref={logsRef}
      >
        {logs.length > 0 ? (
          logs.map((line, i) => (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: line }}
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
