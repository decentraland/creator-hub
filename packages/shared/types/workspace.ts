import type { Project, SortBy } from './projects';

export type Workspace = {
  sortBy: SortBy;
  projects: Project[];
  missing: string[];
  templates: Template[];
};

export type Template = {
  title: string;
  tags: string[] | null;
  github_link: string;
  description: string;
  image_1: string | null;
  play_link: string | null;
  id: number;
  video_1: string | null;
  sdk_version: string;
  scene_type: string[] | null;
  difficulty_level: string | null;
  date_updated: string | null;
  date_created: string;
  resource_type: string;
};
