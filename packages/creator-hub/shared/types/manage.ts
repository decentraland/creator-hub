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
  displayName: string;
  type: ManagedProjectType;
  role: 'owner' | 'operator';
  deployment?: ProjectDeployment;
};

export type ProjectDeployment = {
  title: string;
  description: string;
  thumbnail: string;
  lastPublishedAt: number;
  scenes: SceneDeployment[];
};

export type SceneDeployment = {
  id: string;
  publishedAt: number;
  parcels: string[];
};

export enum WorldSettingsTab {
  DETAILS = 'details',
  LAYOUT = 'layout',
  GENERAL = 'general',
  VARIABLES = 'variables',
  PERMISSIONS = 'permissions',
}
