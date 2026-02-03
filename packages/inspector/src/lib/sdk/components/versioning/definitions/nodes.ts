import { Schemas } from '@dcl/ecs';

export const NODES_VERSIONS = [
  {
    value: Schemas.Array(
      Schemas.Map({
        entity: Schemas.Entity,
        open: Schemas.Optional(Schemas.Boolean),
        children: Schemas.Array(Schemas.Entity),
      }),
    ),
  },
] as const;
