import type { Project, SortBy } from '/shared/types/projects';

export type Props = {
  projects: Project[];
  sortBy: SortBy;
  onOpenModal: (name: string, metadata?: any) => any;
  onSort: (type: SortBy) => void;
};
