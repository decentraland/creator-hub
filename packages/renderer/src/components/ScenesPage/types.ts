import type { Project } from '/shared/types/projects';

export enum SortBy {
  NEWEST = 'newest',
  SIZE = 'size',
  NAME = 'name',
}

export type Props = {
  projects: Project[];
  sortBy: SortBy;
  onOpenModal: (name: string, metadata?: any) => any;
  onSort: (type: SortBy) => void;
};
