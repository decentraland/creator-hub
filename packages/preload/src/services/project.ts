import path from 'path';

import { FileSystemStorage } from '/shared/types/storage';
import type { ProjectInfo } from '/shared/types/projects';
import { getWorkspaceConfigPath } from './config';

export async function getProjectInfoFs(_path: string) {
  const configPath = await getWorkspaceConfigPath(_path);
  const projectInfoPath = path.join(configPath, 'project.json');
  const projectInfo = await FileSystemStorage.getOrCreate<ProjectInfo>(projectInfoPath);
  return projectInfo;
}
