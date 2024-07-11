import type { Project, SortBy } from './projects';

export type Workspace = {
  sortBy: SortBy;
  projects: Project[];
};
