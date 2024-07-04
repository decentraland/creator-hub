import type {Layout} from '/shared/types/projects';

export type Coordinate = {x: number; y: number};

export type Rotation = 'north' | 'east' | 'south' | 'west';

export type Placement = {point: Coordinate; rotation: Rotation};

export enum DeploymentStatus {
  UNPUBLISHED,
  PUBLISHED,
  NEEDS_SYNC,
}

export type Deployment = {
  id: string;
  projectId: string | null;
  timestamp: number;
  name: string;
  thumbnail: string | null;
  placement: Placement;
  owner: string;
  layout: Layout | null;
  base: string;
  parcels: string[];
  world?: string;
};
