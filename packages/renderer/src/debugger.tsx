import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Convert from 'ansi-to-html';

import { editor } from '#preload';

import '/@/themes';

const container = document.getElementById('app')!;
const root = createRoot(container);

function getDebuggerPath() {
  const url = new URL(window.location.href);
  return url.searchParams.get('path');
}

const convert = new Convert();

function Debugger() {
  const debuggerPath = getDebuggerPath();
  const debuggerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const log = useCallback((message: string) => {
    setLogs((prev) => [...prev, message]);
    // Auto-scroll to the bottom
    setTimeout(() => {
      if (debuggerRef.current) {
        debuggerRef.current.scrollTop = debuggerRef.current.scrollHeight;
      }
    }, 0);
  }, [debuggerRef.current]);

  useEffect(() => {
    if (!debuggerPath) return;

    let dettachFromSceneDebugger: (() => void) | undefined;
    editor.attachSceneDebugger(debuggerPath, log).then(({ cleanup }) => {
      dettachFromSceneDebugger = cleanup;
    });

    return () => {
      dettachFromSceneDebugger?.();
    };
  }, []);

  return (
    <main className="Debugger" ref={debuggerRef}>
      {!debuggerPath && <div>No path provided</div>}
      {debuggerPath && (
        <>
          <div>Path provided: {debuggerPath}</div>
          <div className="logs">
            {logs.map(($, i) => (
              <span key={i} dangerouslySetInnerHTML={{ __html: convert.toHtml($) }} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

root.render(
  <React.StrictMode>
    <Debugger />
  </React.StrictMode>,
);
