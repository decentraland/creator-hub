import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ConsoleEntry } from '../../../lib/logic/mobile-debug-store';

function ConsoleView({ entries }: { entries: ConsoleEntry[] }) {
  const [textFilter, setTextFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'log' | 'error'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    let result = entries;
    if (levelFilter !== 'all') {
      result = result.filter(e => e.level === levelFilter);
    }
    if (textFilter) {
      const f = textFilter.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(f));
    }
    return result;
  }, [entries, levelFilter, textFilter]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered, autoScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
      setAutoScroll(nearBottom);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="SceneConsole">
      <div
        ref={scrollRef}
        className="SceneConsole-entries"
      >
        {filtered.length === 0 ? (
          <div className="SceneConsole-empty">
            {entries.length === 0 ? 'No console output yet...' : 'No entries match filter'}
          </div>
        ) : (
          filtered.map((e, i) => (
            <div
              key={i}
              className={`SceneConsole-line ${e.level}`}
            >
              <span className="SceneConsole-time">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <span className="SceneConsole-tick">[{e.tick}]</span>
              <span className="SceneConsole-msg">{e.message}</span>
            </div>
          ))
        )}
      </div>
      <div className="SceneConsole-filterBar">
        <input
          className="SceneConsole-filterInput"
          placeholder="Filter..."
          value={textFilter}
          onChange={e => setTextFilter(e.target.value)}
        />
        <button
          className={`SceneConsole-levelBtn ${levelFilter === 'all' ? 'active' : ''}`}
          onClick={() => setLevelFilter('all')}
        >
          ALL
        </button>
        <button
          className={`SceneConsole-levelBtn ${levelFilter === 'log' ? 'active' : ''}`}
          onClick={() => setLevelFilter('log')}
        >
          LOG
        </button>
        <button
          className={`SceneConsole-levelBtn ${levelFilter === 'error' ? 'active' : ''}`}
          onClick={() => setLevelFilter('error')}
        >
          ERROR
        </button>
        <button
          className={`SceneConsole-levelBtn ${autoScroll ? 'active' : ''}`}
          onClick={() => setAutoScroll(a => !a)}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          AUTO
        </button>
        <span className="SceneConsole-filterCount">
          {filtered.length}/{entries.length}
        </span>
      </div>
    </div>
  );
}

export default ConsoleView;
