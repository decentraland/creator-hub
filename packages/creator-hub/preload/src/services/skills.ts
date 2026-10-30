import type { SkillsUpdateStatus } from '/shared/types/skills';

import { invoke } from './ipc';

export async function getProjectStatus(path: string): Promise<SkillsUpdateStatus> {
  return invoke('skills.getProjectStatus', path);
}

/**
 * Runs `npx skills add decentraland/sdk-skills` in the project, which installs the skills,
 * refreshes them, and adds any published since.
 */
export async function updateProject(path: string): Promise<void> {
  await invoke('skills.updateProject', path);
}
