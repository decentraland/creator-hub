import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  subscribe,
  getSnapshot,
  getPlainText,
  clear,
  type DebugLogEntry,
} from '../../lib/logic/debug-log-store';
import { getSceneClient } from '../../lib/rpc/scene';
import { useAppSelector } from '../../redux/hooks';
import { getDebugConsoleEnabled } from '../../redux/ui';

import './DebugConsole.css';

function DebugConsole() {
  const logs = useSyncExternalStore(subscribe, getSnapshot);
  const enabled = useAppSelector(getDebugConsoleEnabled);
  const logsRef = useRef<HTMLDivElement>(null);
  const prevLogCountRef = useRef(0);
  const [copying, setCopying] = useState(false);

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

  const handleCopyAll = useCallback(async () => {
    if (logs.length === 0 || copying) return;
    const sceneClient = getSceneClient();
    if (!sceneClient) return;
    try {
      setCopying(true);
      const text = getPlainText();
      await sceneClient.copyToClipboard(text);
      await sceneClient.pushNotification({ severity: 'success', message: 'Copied to clipboard' });
    } catch (error) {
      console.error('Failed to copy console logs:', error);
    } finally {
      setCopying(false);
    }
  }, [logs.length, copying]);

  return (
    <div className="DebugConsole">
      <div className="DebugConsole-toolbar">
        <button
          className="DebugConsole-copy-btn"
          onClick={handleCopyAll}
          disabled={logs.length === 0 || copying}
          title="Copy all logs to clipboard"
        >
          {copying ? 'Copying…' : 'Copy All'}
        </button>
      </div>
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
