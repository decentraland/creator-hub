import { ErrorBase } from './error';
import type { Project, SortBy } from './projects';
import type { AppSettings } from './settings';

export type Workspace = {
  sortBy: SortBy;
  projects: Project[];
  missing: string[];
  templates: Template[];
  settings: AppSettings;
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

export type GetProjectsOpts = {
  omitOutdatedPackages?: boolean;
};

export enum WorkspaceErrorType {
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
}

export class WorkspaceError extends ErrorBase<typeof WorkspaceErrorType> {
  constructor(
    public name: WorkspaceErrorType,
    message?: string,
  ) {
    super(name, message);
  }
}

export const isWorkspaceError = (
  error: unknown,
  type: WorkspaceErrorType,
): error is WorkspaceError => error instanceof WorkspaceError && error.name === type;
