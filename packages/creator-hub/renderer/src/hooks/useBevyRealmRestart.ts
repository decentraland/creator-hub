import { useEffect, useRef } from 'react';

import { editor } from '#preload';

export const MAX_AUTO_RESTARTS = 3;

/** Restart the project's Bevy realm after an unexpected exit, giving up after MAX_AUTO_RESTARTS. */
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
    return editor.onBevyRealmExit(({ path }) => {
      if (path !== projectPath) return;
      crashes.current += 1;
      if (crashes.current <= MAX_AUTO_RESTARTS) handlersRef.current.onRestart();
      else handlersRef.current.onGiveUp();
    });
  }, [projectPath]);
}
