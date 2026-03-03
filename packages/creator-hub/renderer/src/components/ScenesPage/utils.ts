import { type Project, SortBy } from '/shared/types/projects';

function isPublished(project: Project): boolean {
  return project.publishedAt > 0;
}

export function sortProjectsBy(projects: Project[], type: SortBy): Project[] {
  switch (type) {
    case SortBy.NEWEST:
      return projects.toSorted((a, b) => b.updatedAt - a.updatedAt);
    case SortBy.OLDEST:
      return projects.toSorted((a, b) => a.updatedAt - b.updatedAt);
    case SortBy.NAME:
      return projects.toSorted((a, b) => (a.title || '').localeCompare(b.title || ''));
    case SortBy.NAME_DESC:
      return projects.toSorted((a, b) => (b.title || '').localeCompare(a.title || ''));
    case SortBy.SIZE:
      return projects.toSorted((a, b) => b.size - a.size);
    case SortBy.STATUS_PUBLISHED_FIRST:
      return projects.toSorted((a, b) => {
        const aPub = isPublished(a) ? 1 : 0;
        const bPub = isPublished(b) ? 1 : 0;
        return bPub - aPub || b.updatedAt - a.updatedAt;
      });
    case SortBy.STATUS_UNPUBLISHED_FIRST:
      return projects.toSorted((a, b) => {
        const aPub = isPublished(a) ? 1 : 0;
        const bPub = isPublished(b) ? 1 : 0;
        return aPub - bPub || b.updatedAt - a.updatedAt;
      });
  }
}
