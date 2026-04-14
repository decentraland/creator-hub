import { useEffect, useRef, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

const SESSION_POLL_INTERVAL = 2000;

/**
 * Forwards scene log entries from the main process to the inspector iframe.
 *
 * Uses push-based IPC for entries (real-time) and polling only for session status.
 */
export function useSceneLogForwarding(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  isPreviewRunning: boolean,
) {
  const wasEnabledRef = useRef(false);

  useEffect(() => {
    if (!isPreviewRunning || !iframeRef.current) return;

    const scene = iframeRef.current.scene;

    // Push-based: subscribe to entries from main process
    const unsubscribe = editor.onSceneLogEntries(({ entries }) => {
      if (!wasEnabledRef.current) {
        wasEnabledRef.current = true;
        void scene
          .setMobileSessionEnabled(true, [])
          .catch(err => console.warn('[scene-log-forwarding]', err));
        void scene
          .selectAssetsTab('MobileSession')
          .catch(err => console.warn('[scene-log-forwarding]', err));
      }
      void scene
        .pushSceneLogEntries(entries)
        .catch(err => console.warn('[scene-log-forwarding]', err));
    });

    // Poll-based: session status only (low frequency)
    const pollSessions = async () => {
      try {
        const sessions = await editor.getSceneLogSessions();
        const enabled = sessions.some(s => s.status === 'active');
        void scene
          .setMobileSessionEnabled(
            enabled || sessions.length > 0,
            sessions.map(s => ({
              id: s.id,
              sessionId: s.sessionId ?? null,
              deviceName: s.deviceName ?? null,
              status: s.status,
              messageCount: s.messageCount,
            })),
          )
          .catch(err => console.warn('[scene-log-forwarding]', err));
      } catch (err) {
        console.warn('[scene-log-forwarding]', err);
      }
    };
    const interval = setInterval(pollSessions, SESSION_POLL_INTERVAL);
    pollSessions();

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isPreviewRunning]);
}
