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
  isImported: boolean;
  size: number;
};
