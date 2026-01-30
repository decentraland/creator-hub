import { Schemas } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const SELECTION_BASE_NAME = BaseComponentNames.SELECTION;

const SelectionV0 = {
  gizmo: Schemas.Int,
};

export const SELECTION_VERSIONS = [{ versionName: SELECTION_BASE_NAME, component: SelectionV0 }];
