/// TODO: add the real options
export enum SortBy {
  LATEST = 'latest',
}

export enum ManagedProjectType {
  WORLD = 'world',
  LAND = 'land',
}

export type ManagedProject = {
  id: string;
  type: ManagedProjectType;
  role: 'owner' | 'operator';
  title?: string;
  thumbnail?: string;
  publishedAt: number;
  totalParcels?: number;
  totalScenes: number;
};

export enum WorldSettingsTab {
  DETAILS = 'details',
  LAYOUT = 'layout',
  GENERAL = 'general',
  VARIABLES = 'variables',
  PERMISSIONS = 'permissions',
}
