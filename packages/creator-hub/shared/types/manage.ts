import type { RoleType as LandRoleType } from '/@/lib/land';
import type { WorldRoleType } from '/@/lib/worlds';

export enum FilterBy {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

export enum SortBy {
  LATEST = 'last_deployed_at',
  NAME = 'name',
}

export enum ManagedProjectType {
  WORLD = 'world',
  LAND = 'land',
}

export type ManagedProject = {
  id: string;
  displayName: string;
  type: ManagedProjectType;
  role: LandRoleType | WorldRoleType;
  deployment?: ProjectDeployment;
  /**
   * Base coordinate of each scene deployed in this world. A world can hold
   * several at different coordinates, and analytics is keyed per scene, so the
   * coordinates are needed to ask about it — most are `0,0`, but far from all.
   */
  scenes?: Array<{ x: number; y: number }>;
};

export type ProjectDeployment = {
  title: string;
  description: string;
  thumbnail: string;
  lastPublishedAt: number;
  scenesCount: number;
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
