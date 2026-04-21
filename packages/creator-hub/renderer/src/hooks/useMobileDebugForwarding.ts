import { useEffect, useRef, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

export function useMobileDebugForwarding(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  isPreviewRunning: boolean,
  projectKey?: string,
) {
  const wasEnabledRef = useRef(false);

  useEffect(() => {
    wasEnabledRef.current = false;
  }, [projectKey]);

  useEffect(() => {
    if (!isPreviewRunning) return;

    const getScene = () => iframeRef.current?.scene;

    const unsubscribeEntries = editor.onMobileDebugEntries(({ entries }) => {
      const scene = getScene();
      if (!scene) return;
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

    const unsubscribeSessions = editor.onMobileDebugSessions(sessions => {
      const scene = getScene();
      if (!scene) return;
      const enabled = sessions.some(s => s.status === 'active') || sessions.length > 0;
      void scene
        .setMobileDebugSessionEnabled(
          enabled,
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
