import React, { useCallback, useEffect, useState } from 'react';
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
  const [logs, setLogs] = useState<string[]>([]);

  const log = useCallback((message: string) => {
    console.log('LOG', message);
    setLogs((prev) => [...prev, message]);
  }, []);

  useEffect(() => {
    if (!debuggerPath) return;

    let dettachFromSceneDebugger: () => void;
    editor.attachToSceneDebugger(debuggerPath, log).then(({ cleanup }) => {
      dettachFromSceneDebugger = cleanup;
    });

    return () => {
      dettachFromSceneDebugger?.();
    };
  }, []);

  return (
    <main className="Debugger">
      {!debuggerPath && <div>No path provided</div>}
      {debuggerPath && (
        <>
          <div>Path provided: {debuggerPath}</div>
          <div className="logs">
            {/* <pre>{logs.join('\n')}</pre> */}
            {logs.map(($) => (
              <span dangerouslySetInnerHTML={{ __html: convert.toHtml($) }} />
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
