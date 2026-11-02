import { useEffect, useRef } from 'react';

import { editor } from '#preload';

export const MAX_AUTO_RESTARTS = 3;
// A realm that served this long before exiting is a fresh failure, not part of a crash
// loop, so it starts the count over instead of spending the scene open's last restart.
export const HEALTHY_UPTIME_MS = 60_000;

/** Restart the project's Bevy realm after an unexpected exit, giving up after MAX_AUTO_RESTARTS in a row. */
export function useBevyRealmRestart(
  projectPath: string | undefined,
  handlers: { onRestart: () => void; onGiveUp: () => void },
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const crashes = useRef(0);

  useEffect(() => {
    crashes.current = 0;
    if (!projectPath) return;
    return editor.onBevyRealmExit(({ path, uptimeMs }) => {
      if (path !== projectPath) return;
      if (uptimeMs >= HEALTHY_UPTIME_MS) crashes.current = 0;
      crashes.current += 1;
      if (crashes.current <= MAX_AUTO_RESTARTS) handlersRef.current.onRestart();
      else handlersRef.current.onGiveUp();
    });
  }, [projectPath]);
}
