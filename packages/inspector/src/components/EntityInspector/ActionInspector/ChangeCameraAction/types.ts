import type { Entity } from '@dcl/ecs';
import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export type Props = {
  entity: Entity;
  value: ActionPayload<ActionType.CHANGE_CAMERA>;
  onUpdate: (value: ActionPayload<ActionType.CHANGE_CAMERA>) => void;
};
