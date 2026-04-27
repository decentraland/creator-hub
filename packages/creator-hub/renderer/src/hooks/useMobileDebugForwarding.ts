import { useEffect, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

export function useMobileDebugForwarding(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  isPreviewRunning: boolean,
  projectKey?: string,
) {
  useEffect(() => {
    if (!isPreviewRunning) return;

    let enabled = false;
    const getScene = () => iframeRef.current?.scene;

    const unsubscribeEntries = editor.onMobileDebugEntries(({ entries }) => {
      const scene = getScene();
      if (!scene) return;
      if (!enabled) {
        enabled = true;
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

    const unsubscribeSessions = editor.onMobileDebugSessions(sessions => {
      const scene = getScene();
      if (!scene) return;
      void scene
        .setMobileDebugSessionEnabled(
          sessions.length > 0,
          sessions.map(s => ({
            id: s.id,
            sessionId: s.sessionId ?? null,
            deviceName: s.deviceName ?? null,
            status: s.status,
            messageCount: s.messageCount,
          })),
        )
        .catch(err => console.warn('[mobile-debug-forwarding]', err));
    });

    return () => {
      unsubscribeEntries();
      unsubscribeSessions();
    };
  }, [isPreviewRunning, projectKey]);
}
