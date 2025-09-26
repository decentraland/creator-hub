import type { Entity } from '@dcl/ecs';

export type Props = {
  open: boolean;
  onClose: () => void;
  editingTag: string | null;
  entity: Entity;
};
