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

export enum ProjectErrorType {
  PROJECT_NOT_CREATED = 'PROJECT_NOT_CREATED',
  INVALID_PATH = 'INVALID_PATH',
}

export class ProjectError extends ErrorBase<typeof ProjectErrorType> {
  constructor(
    public name: ProjectErrorType,
    message?: string,
  ) {
    super(name, message);
  }
}

export const isProjectError = (error: unknown, type: ProjectErrorType): error is ProjectError =>
  error instanceof ProjectError && (error.name === type || error.message === type);
