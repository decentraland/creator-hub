import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { subscribe, getSnapshot, clear, type DebugLogEntry } from '../../lib/logic/debug-log-store';
import { useAppSelector } from '../../redux/hooks';
import { getDebugConsoleEnabled } from '../../redux/ui';

import './DebugConsole.css';

const SCROLL_THRESHOLD = 10;

function DebugConsole() {
  const logs = useSyncExternalStore(subscribe, getSnapshot);
  const enabled = useAppSelector(getDebugConsoleEnabled);
  const logsRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = logsRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!enabled) {
      clear();
    }
  }, [enabled]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('.DebugConsole')) return;
      const selection = window.getSelection();
      if (!selection || selection.toString().length === 0) return;
      const anchorNode = selection.anchorNode;
      const anchorElement =
        anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as Element)
          : (anchorNode?.parentElement ?? null);
      if (anchorElement?.closest('.DebugConsole')) {
        selection.removeAllRanges();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <div className="DebugConsole">
      <div
        className="DebugConsole-logs"
        ref={logsRef}
        onScroll={handleScroll}
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
