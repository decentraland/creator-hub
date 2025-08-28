import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export enum MeshType {
  MT_BOX = 'box',
  MT_SPHERE = 'sphere',
  MT_CYLINDER = 'cylinder',
  MT_PLANE = 'plane',
}

export type MeshRendererInput = {
  mesh: MeshType;
  radiusTop?: string;
  radiusBottom?: string;
  uvs?: string;
};
