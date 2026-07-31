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

export type ErrorName =
  | 'PROJECT_NOT_CREATED'
  | 'INVALID_PATH'
  | 'FAILED_TO_RUN_PROJECT'
  | 'FAILED_TO_INSTALL_DEPENDENCIES'
  | 'PROJECT_ALREADY_IMPORTED';

export class ProjectError extends ErrorBase<ErrorName> {}

/**
 * Errors thrown from the preload layer can lose their class identity by the
 * time they reach the renderer (they cross an RPC-style bridge), so callers
 * cannot rely on `instanceof ProjectError`/`error.name` to detect them there.
 * `.message` is the one property guaranteed to survive that trip, so preload
 * prefixes messages for this case with this stable sentinel, and the
 * renderer matches on it before constructing a fresh `ProjectError`.
 */
export const PROJECT_ALREADY_IMPORTED_ERROR_PREFIX = 'PROJECT_ALREADY_IMPORTED';

export const isProjectError = (error: unknown, type?: ErrorName): error is ProjectError =>
  error instanceof ProjectError && (!type || error.name === type || error.message === type);
