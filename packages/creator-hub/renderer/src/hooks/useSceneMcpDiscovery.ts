import { useEffect } from 'react';

import { ai } from '#preload';

/**
 * While a project is open in the editor, tell main which scene it is, so the Creator Hub MCP
 * server targets it and — with the "Expose AI assistant MCP server" setting on — its
 * connection details are written into the scene (`.mcp.json`) for AI agents running outside
 * the app. Main keeps the file on close; the close call only clears which scene a later
 * setting flip should write into.
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
