import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { MdOpenInNew } from 'react-icons/md';

import { parseAnsi } from '../../lib/logic/ansi';
import { subscribe, getSnapshot, clear, type DebugLogEntry } from '../../lib/logic/debug-log-store';
import { getSceneClient } from '../../lib/rpc/scene';
import { useAppSelector } from '../../redux/hooks';
import { getDebugConsoleEnabled, getDebugConsoleDetached } from '../../redux/ui';

import './DebugConsole.css';

const SCROLL_THRESHOLD = 10;

/**
 * A single log line, rendered as styled spans.
 *
 * Memoized, and declared here rather than inside `DebugConsole`: entries are immutable and
 * keyed by id, so each line is parsed once while it stays mounted instead of on every render
 * of a console holding up to `MAX_ENTRIES` of them. The outer span is what
 * `.DebugConsole-logs > span` styles as a block, so it has to stay a direct child.
 */
const LogLine = React.memo(function LogLine({ text }: { text: string }) {
  return (
    <span>
      {parseAnsi(text).map((segment, index) => {
        const { text: content, ...style } = segment;
        return (
          <span
            key={index}
            style={style}
          >
            {content}
          </span>
        );
      })}
    </span>
  );
});

function DebugConsole() {
  const logs = useSyncExternalStore(subscribe, getSnapshot);
  const enabled = useAppSelector(getDebugConsoleEnabled);
  const detached = useAppSelector(getDebugConsoleDetached);
  const logsRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = logsRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
  }, []);

  const popOut = useCallback(() => {
    void getSceneClient()?.setConsoleWindowOpen(true).catch(console.error);
  }, []);

  const dockBack = useCallback(() => {
    void getSceneClient()?.setConsoleWindowOpen(false).catch(console.error);
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
    const isSelectionInConsole = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().length === 0) return false;
      const anchorNode = selection.anchorNode;
      const anchorElement =
        anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as Element)
          : (anchorNode?.parentElement ?? null);
      return !!anchorElement?.closest('.DebugConsole');
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('.DebugConsole')) return;
      if (isSelectionInConsole()) {
        window.getSelection()?.removeAllRanges();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCopy = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c';
      if (!isCopy) return;
      if (isSelectionInConsole()) {
        e.stopPropagation();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Popped out into its own window (#1272): the logs render there, so the inline tab holds a
  // placeholder that offers to dock the console back.
  if (detached) {
    return (
      <div className="DebugConsole DebugConsole--detached">
        <div className="DebugConsole-detachedMessage">
          <span>Console opened in a separate window</span>
          <button
            className="DebugConsole-dockButton"
            onClick={dockBack}
          >
            <MdOpenInNew />
            <span>Dock back here</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="DebugConsole">
      <div className="DebugConsole-header">
        <button
          className="DebugConsole-popOut"
          onClick={popOut}
          title="Open console in a separate window"
          aria-label="Open console in a separate window"
        >
          <MdOpenInNew />
        </button>
      </div>
      <div
        className="DebugConsole-logs"
        ref={logsRef}
        onScroll={handleScroll}
      >
        {logs.length > 0 ? (
          logs.map((entry: DebugLogEntry) => (
            <LogLine
              key={entry.id}
              text={entry.text}
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
