import { ComponentType } from '@dcl/ecs';
import type { ComponentOperation } from '../component-operations';

/**
 * Component operation for Billboard component.
 * In the inspector, we don't apply billboard mode to preserve the original Transform rotation
 * for better editing experience. Billboard only affects rendering in the production engine.
 */
export const putBillboardComponent: ComponentOperation = (entity, component) => {
  // Billboard mode is not applied in the inspector to keep entities at their original Transform rotation
  // This makes it easier to edit and position entities. Billboard will work correctly in production.
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    // Do nothing - don't apply billboard mode in the inspector
  }
};
