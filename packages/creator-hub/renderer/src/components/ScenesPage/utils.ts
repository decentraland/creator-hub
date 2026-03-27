import { type Project, SortBy } from '/shared/types/projects';

export function sortProjectsBy(projects: Project[], type: SortBy): Project[] {
  switch (type) {
    case SortBy.NEWEST:
      return projects.toSorted((a, b) => b.updatedAt - a.updatedAt);
    case SortBy.NAME:
      return projects.toSorted((a, b) => (a.title || '').localeCompare(b.title || ''));
    case SortBy.SIZE:
      return projects.toSorted((a, b) => b.size - a.size);
    case SortBy.PARCELS:
      return projects.toSorted(
        (a, b) => b.layout.cols * b.layout.rows - a.layout.cols * a.layout.rows,
      );
  }
}
