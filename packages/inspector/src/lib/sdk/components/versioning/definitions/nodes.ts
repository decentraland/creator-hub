import { Schemas } from '@dcl/ecs';

const NodesV0 = {
  value: Schemas.Array(
    Schemas.Map({
      entity: Schemas.Entity,
      open: Schemas.Optional(Schemas.Boolean),
      children: Schemas.Array(Schemas.Entity),
    }),
  ),
};

export const NODES_VERSIONS = [NodesV0] as const;
