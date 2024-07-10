export type Layout = {
  rows: number;
  cols: number;
};

export enum TemplateStatus {
  ACTIVE = 'active',
  COMING_SOON = 'coming_soon',
}

export type Project = {
  path: string;
  title?: string;
  thumbnail?: string;
  layout: Layout;
};
