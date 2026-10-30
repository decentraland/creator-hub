import { useEffect } from 'react';

import { ai } from '#preload';

/**
 * While a project is open in the editor, tell main which scene it is, so the Creator Hub MCP
 * server targets it and, with outside access on, Claude Code started in the scene folder finds
 * it (`.mcp.json`). On close, main detaches the server and removes that file.
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
