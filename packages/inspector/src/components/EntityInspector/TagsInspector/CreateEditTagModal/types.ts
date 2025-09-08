import type { Entity } from '@dcl/ecs';

export type Props = {
  open: boolean;
  onClose: () => void;
  entityId: Entity;
};
