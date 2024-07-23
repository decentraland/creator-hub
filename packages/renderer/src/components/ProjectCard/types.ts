import type { Project } from '/shared/types/projects';

export type Props = {
  project: Project;
  onClick: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDuplicate: (project: Project) => void;
};
