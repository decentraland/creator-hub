import { useEffect } from 'react';

import { ai } from '#preload';

/**
 * While a project is open in the editor, tell main which scene it is, so the Creator Hub MCP
 * server targets it. On close, main detaches the server, so scene tools fail fast instead of
 * acting on a scene that isn't open.
 */
export function useSceneMcpDiscovery(projectPath: string | undefined) {
  useEffect(() => {
    if (!projectPath) return;
    void ai.sceneOpened(projectPath).catch(() => {});
    return () => {
      void ai.sceneClosed(projectPath).catch(() => {});
    };
  }, [projectPath]);
}
