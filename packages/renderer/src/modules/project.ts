import type { Project } from '/shared/types/projects';

export function getThumbnailUrl(project: Project) {
  return project.thumbnail ? `data:image/png;base64,${project.thumbnail}` : undefined;
}
