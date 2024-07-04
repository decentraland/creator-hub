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
  description?: string;
  thumbnail?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  layout: Layout;
  isTemplate: boolean;
  video: string | null;
  templateStatus: TemplateStatus | null;
};
