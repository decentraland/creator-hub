import { Schemas } from '@dcl/ecs';

export const SELECTION_VERSIONS = [
  { gizmo: Schemas.Int },
  { gizmo: Schemas.Int, testing: Schemas.Optional(Schemas.Number) },
] as const;
