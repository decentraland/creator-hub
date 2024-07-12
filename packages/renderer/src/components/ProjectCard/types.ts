import type { Project } from '/shared/types/projects';

export type Props = {
  project: Project;
  onDelete: (project: Project) => void;
  onDuplicate: (project: Project) => void;
};
