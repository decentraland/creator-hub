import type { Entity } from '@dcl/ecs';

export type Props = {
  open: boolean;
  onClose: () => void;
  tag: string | null;
  entity: Entity;
};
