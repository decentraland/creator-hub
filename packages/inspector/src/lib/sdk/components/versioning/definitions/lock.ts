import { Schemas } from '@dcl/ecs';

const LockV0 = { value: Schemas.Boolean };

export const LOCK_VERSIONS = [LockV0] as const;
