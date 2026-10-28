import { useEffect } from 'react';

import { ai } from '#preload';

/**
 * While a project is open in the editor, tell main which scene it is, so the Creator Hub MCP
 * server targets it and — with "Allow AI agents outside Creator Hub" on — its connection
 * details are written into the scene (`.mcp.json`) for AI agents running outside the app.
 * On close, main detaches the server from the scene and removes that file.
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
