import { ErrorBase } from './error';
import type { Project, SortBy } from './projects';
import type { AppSettings } from './settings';

export type Workspace = {
  sortBy: SortBy;
  projects: Project[];
  missing: string[];
  settings: AppSettings;
};

export type GetProjectsOpts = {
  omitOutdatedPackages?: boolean;
};

export type Error = 'PROJECT_NOT_FOUND';

export class WorkspaceError extends ErrorBase<Error> {}

export const isWorkspaceError = (error: unknown, type: Error): error is WorkspaceError =>
  error instanceof WorkspaceError && error.name === type;
