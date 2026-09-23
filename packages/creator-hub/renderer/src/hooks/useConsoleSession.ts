import { useEffect, useState } from 'react';

import { consoleWindow as consolePreload } from '#preload';

// The detached console window bridge (#1272), mounted in the editor (main window). The pop-out
// / dock-back controls live INSIDE the inspector iframe, so this hook doesn't open the window
// itself (the scene RPC server does, on the inspector's request). It only:
//   - tracks whether the detached window is open, so the caller can flag the inline tab, and
//   - relays the preview-running state to the window while it's open, so the window knows to
//     (re)attach to the debugger on the next run.
// It also closes the window when the editor unmounts, so it can't linger disconnected.
export function useConsoleSession(
  // The console feature is available at all (preview debugger on). When it turns off, the
  // detached window is closed too.
  enabled: boolean,
  isPreviewRunning: boolean,
) {
  const [detachedOpen, setDetachedOpen] = useState(false);

  // Learn whether the detached window is open (initial + on change).
  useEffect(() => {
    void consolePreload.isConsoleWindowOpen().then(setDetachedOpen);
    const { cleanup } = consolePreload.onConsoleWindowState(({ open }) => setDetachedOpen(open));
    return cleanup;
  }, []);

  // Relay the preview-running state to the detached window while it's open.
  useEffect(() => {
    if (!detachedOpen) return;
    consolePreload.pushConsoleMirrorState({ previewRunning: isPreviewRunning });
  }, [detachedOpen, isPreviewRunning]);

  // Close the detached window when the console feature is turned off, or when the editor
  // unmounts (navigating away) — it relies on this hook for its preview-running signal.
  useEffect(() => {
    if (enabled) return;
    void consolePreload.closeConsoleWindow();
  }, [enabled]);

  useEffect(() => {
    return () => {
      void consolePreload.closeConsoleWindow();
    };
  }, []);

  return { detachedOpen };
}
