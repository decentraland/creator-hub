import type { Entity } from '@dcl/ecs';

import type { MeshType } from '../MeshRendererInspector/types';

export interface Props {
  entity: Entity;
}

export type MeshColliderInput = {
  mesh: MeshType;
  radiusTop?: string;
  radiusBottom?: string;
  collisionMask?: string;
};
