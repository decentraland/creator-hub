import { useEffect, useRef, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

const SESSION_POLL_INTERVAL = 2000;

export function useMobileDebugForwarding(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  isPreviewRunning: boolean,
) {
  const wasEnabledRef = useRef(false);

  useEffect(() => {
    if (!isPreviewRunning || !iframeRef.current) return;

    const scene = iframeRef.current.scene;

    const unsubscribe = editor.onMobileDebugEntries(({ entries }) => {
      if (!wasEnabledRef.current) {
        wasEnabledRef.current = true;
        void scene
          .setMobileDebugSessionEnabled(true, [])
          .catch(err => console.warn('[mobile-debug-forwarding]', err));
        void scene
          .selectAssetsTab('MobileDebugSession')
          .catch(err => console.warn('[mobile-debug-forwarding]', err));
      }
      void scene
        .pushMobileDebugEntries(entries)
        .catch(err => console.warn('[mobile-debug-forwarding]', err));
    });

    const pollSessions = async () => {
      try {
        const sessions = await editor.getMobileDebugSessions();
        const enabled = sessions.some(s => s.status === 'active');
        void scene
          .setMobileDebugSessionEnabled(
            enabled || sessions.length > 0,
            sessions.map(s => ({
              id: s.id,
              sessionId: s.sessionId ?? null,
              deviceName: s.deviceName ?? null,
              status: s.status,
              messageCount: s.messageCount,
            })),
          )
          .catch(err => console.warn('[mobile-debug-forwarding]', err));
      } catch (err) {
        console.warn('[mobile-debug-forwarding]', err);
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
