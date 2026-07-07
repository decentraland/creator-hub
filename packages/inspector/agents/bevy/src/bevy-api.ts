/**
 * The explorer's system API (`~system/BevyExplorerApi`), available to super-user
 * scenes only. Minimal surface used by this agent: login (identity, else boot
 * hangs), liveSceneInfo (to pin the inspected scene), and consoleCommand
 * (set_scene, set_component for the gizmo's live drag preview).
 */

interface LiveSceneInfo {
  hash: string;
  parcels: { x: number; y: number }[];
  isPortable: boolean;
  isSuper: boolean;
}

export interface BevyApi {
  getPreviousLogin: () => Promise<{ userId: string | null }>;
  loginPrevious: () => Promise<{ success: boolean; error: string }>;
  loginGuest: () => void;
  liveSceneInfo: () => Promise<LiveSceneInfo[]>;
  consoleCommand: (cmd: string, args?: string[]) => Promise<string>;
}

export function getBevyApi(): BevyApi | null {
  try {
    return (
      (globalThis as { require?: (m: string) => BevyApi }).require?.('~system/BevyExplorerApi') ??
      null
    );
  } catch {
    return null;
  }
}

export type { LiveSceneInfo };
