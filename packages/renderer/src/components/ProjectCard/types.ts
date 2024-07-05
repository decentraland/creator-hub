import type { Project } from '/shared/types/projects';

export type Props = {
  project: Project;
  onClick?: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onDuplicateProject: (project: Project) => void;
  onOpenModal: (name: string, metadata: any) => any;
  onLoadProjectScene: (project: Project) => void;
};
