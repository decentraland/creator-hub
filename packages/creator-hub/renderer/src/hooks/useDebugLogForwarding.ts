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
      .attachSceneDebugger(projectPath, (data: string) => {
        logBatchRef.current.push(convert.toHtml(data));
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
  }, [isPreviewRunning, showDebugPanel, projectPath, iframeRef]);
}
