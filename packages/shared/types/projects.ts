import { type Scene } from '@dcl/schemas';

export type Layout = {
  rows: number;
  cols: number;
};

export enum TemplateStatus {
  ACTIVE = 'active',
  COMING_SOON = 'coming_soon',
}

export enum SortBy {
  NEWEST = 'newest',
  SIZE = 'size',
  NAME = 'name',
}

export type Project = {
  path: string;
  title: string;
  description?: string;
  thumbnail: string;
  layout: Layout;
  createdAt: number;
  updatedAt: number;
  size: number;
  scene: Scene;
};
