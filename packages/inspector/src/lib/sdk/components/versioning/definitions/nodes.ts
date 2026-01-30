import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../constants';

const NODES_BASE_NAME = BaseComponentNames.NODES;

const NodesV0 = {
  value: Schemas.Array(
    Schemas.Map({
      entity: Schemas.Entity,
      open: Schemas.Optional(Schemas.Boolean),
      children: Schemas.Array(Schemas.Entity),
    }),
  ),
};

export const NODES_VERSIONS = [{ versionName: NODES_BASE_NAME, component: NodesV0 }];

export function defineNodesComponent(engine: IEngine) {
  return engine.defineComponent(NODES_BASE_NAME, NodesV0);
}
