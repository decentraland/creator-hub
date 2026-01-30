import { Schemas } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

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
