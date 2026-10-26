import type { SkillsUpdateStatus } from '/shared/types/skills';

import { invoke } from './ipc';

export async function getProjectStatus(path: string): Promise<SkillsUpdateStatus> {
  return invoke('skills.getProjectStatus', path);
}

/**
 * Re-runs `npx skills add decentraland/sdk-skills --all` in the project, which refreshes
 * the installed skills and adds any published since.
 */
export async function updateProject(path: string): Promise<void> {
  await invoke('skills.updateProject', path);
}
