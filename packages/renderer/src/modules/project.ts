import type { Project } from '/shared/types/projects';

export function getThumbnailUrl(project: Project) {
  return project.thumbnail;
}
