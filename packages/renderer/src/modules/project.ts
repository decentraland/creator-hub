import type { Project } from '/shared/types/projects';

export function getThumbnailUrl(project: Project) {
  return project.thumbnail ? `data:image/png;base64,${project.thumbnail}` : undefined;
}

export function ellipsisAtMiddle(value: string, maxLen: number): string {
  if (value.length <= maxLen + 3) return value;
  const half = Math.floor(maxLen / 2);

  const start = value.slice(0, Math.max(0, half - 3)).trim();
  const end = value.slice(-half).trim();

  return `${start}...${end}`;
}
