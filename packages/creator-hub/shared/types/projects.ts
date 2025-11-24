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
  SIZE = 'size',
  NAME = 'name',
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

export type ErrorName = 'PROJECT_NOT_CREATED' | 'INVALID_PATH' | 'FAILED_TO_RUN_PROJECT';

export class ProjectError extends ErrorBase<ErrorName> {}

export const isProjectError = (error: unknown, type?: ErrorName): error is ProjectError =>
  error instanceof ProjectError && (!type || error.name === type || error.message === type);
