import type { ManagedProject } from '/shared/types/manage';
import { SortBy } from '/shared/types/manage';

export function filterProjectsBy(projects: ManagedProject[], searchQuery: string) {
  if (!searchQuery) return projects;
  return projects.filter(project =>
    [project.id, project.displayName, project.deployment?.title ?? '']
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );
}
export function sortProjectsBy(projects: ManagedProject[], type: SortBy): ManagedProject[] {
  switch (type) {
    case SortBy.LATEST:
      return projects.toSorted(
        (a, b) => (b.deployment?.lastPublishedAt ?? 0) - (a.deployment?.lastPublishedAt ?? 0),
      );
    default:
      return projects;
  }
}
