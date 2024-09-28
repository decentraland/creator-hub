import type { WorldConfiguration } from '@dcl/schemas';

export type Layout = {
  rows: number;
  cols: number;
};

export enum SortBy {
  NEWEST = 'newest',
  SIZE = 'size',
  NAME = 'name',
}

export type ProjectInfo = {
  id: string;
};

export type Project = {
  id: string;
  path: string;
  title: string;
  description?: string;
  thumbnail: string;
  layout: Layout;
  createdAt: number;
  updatedAt: number;
  size: number;
  worldConfiguration?: WorldConfiguration;
};
