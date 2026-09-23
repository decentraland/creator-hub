import { useEffect, useRef, type MutableRefObject } from 'react';
import Convert from 'ansi-to-html';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

const convert = new Convert({ escapeXML: true });
const LOG_BATCH_INTERVAL = 100;

export function useDebugLogForwarding(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  isPreviewRunning: boolean,
  showDebugPanel: boolean,
  projectPath: string | undefined,
  // The console has been popped out into a separate window (#1272). We keep forwarding logs
  // into the inspector store regardless (so docking back is instant), and only flip the
  // inspector's inline tab between the logs and a "opened in a separate window" placeholder.
  consoleDetached = false,
  // Bumped each time a (re)loaded inspector reports its scene RPC server ready. The ref
  // itself is stable across an iframe reload, so without this the forwarding would keep
  // feeding the disposed RPC and the fresh inspector never learns the console is enabled.
  inspectorReadyNonce = 0,
) {
  const logBatchRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!isPreviewRunning || !showDebugPanel || !projectPath || !iframeRef.current) return;

    const scene = iframeRef.current.scene;
    // RPC call may fail if the inspector iframe is not ready or was destroyed
    void scene.setDebugConsoleEnabled(true).catch(() => {});

    const flushLogs = () => {
      if (logBatchRef.current.length > 0) {
        const batch = logBatchRef.current;
        logBatchRef.current = [];
        // RPC call may fail if the inspector iframe was destroyed
        void scene.pushDebugLogs(batch).catch(() => {});
      }
    };

    timerRef.current = setInterval(flushLogs, LOG_BATCH_INTERVAL);

    let aborted = false;
    let cleanupFn: (() => void) | undefined;

    editor
      .attachSceneDebugger(projectPath, (data: string | string[]) => {
        const lines = Array.isArray(data) ? data : data.split('\n');
        for (const line of lines) {
          if (line.trim() !== '') {
            logBatchRef.current.push(convert.toHtml(line));
          }
        }
      })
      .then(({ cleanup }) => {
        if (aborted) {
          cleanup();
        } else {
          cleanupFn = cleanup;
        }
      })
      // Preview may have exited before we could attach
      .catch(() => {});

    return () => {
      aborted = true;
      cleanupFn?.();
      if (timerRef.current) clearInterval(timerRef.current);
      flushLogs();
      // RPC call may fail if the inspector iframe was destroyed
      void scene.setDebugConsoleEnabled(false).catch(() => {});
    };
  }, [isPreviewRunning, showDebugPanel, projectPath, iframeRef, inspectorReadyNonce]);

  // Reflect the detached state into the inspector's inline tab (logs vs placeholder) without
  // tearing down the forwarding above, so toggling pop-out/dock doesn't flicker the tab.
  useEffect(() => {
    if (!isPreviewRunning || !showDebugPanel || !projectPath || !iframeRef.current) return;
    void iframeRef.current.scene.setConsoleDetached(consoleDetached).catch(() => {});
  }, [
    consoleDetached,
    isPreviewRunning,
    showDebugPanel,
    projectPath,
    iframeRef,
    inspectorReadyNonce,
  ]);
}
