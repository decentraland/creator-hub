import { Schemas } from '@dcl/ecs';

const HideV0 = { value: Schemas.Boolean };

export const HIDE_VERSIONS = [HideV0] as const;
