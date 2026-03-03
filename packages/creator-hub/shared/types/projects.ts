import type { SceneParcels, WorldConfiguration } from '@dcl/schemas';

import type { Status } from '/shared/types/async';

import type { Outdated } from './npm';
import type { PACKAGES } from './pkg';
import { ErrorBase } from './error';

export type Layout = {
  rows: number;
  cols: number;
};

export enum SortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  SIZE = 'size',
  NAME = 'name',
  NAME_DESC = 'name_desc',
  STATUS_PUBLISHED_FIRST = 'status_published_first',
  STATUS_UNPUBLISHED_FIRST = 'status_unpublished_first',
}

export type DependencyState = { [k in PACKAGES]?: Outdated[keyof Outdated] };

export type ProjectInfo = {
  id: string;
  skipPublishWarning: boolean;
};

export type Project = {
  id: string;
  path: string;
  title: string;
  description?: string;
  thumbnail: string;
  layout: Layout;
  scene: SceneParcels;
  createdAt: number;
  updatedAt: number;
  publishedAt: number;
  size: number;
  worldConfiguration?: WorldConfiguration;
  dependencyAvailableUpdates: DependencyState;
  status?: Status;
  info: ProjectInfo;
};

export type ErrorName =
  | 'PROJECT_NOT_CREATED'
  | 'INVALID_PATH'
  | 'FAILED_TO_RUN_PROJECT'
  | 'FAILED_TO_INSTALL_DEPENDENCIES';

export class ProjectError extends ErrorBase<ErrorName> {}

export const isProjectError = (error: unknown, type?: ErrorName): error is ProjectError =>
  error instanceof ProjectError && (!type || error.name === type || error.message === type);
