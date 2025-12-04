import mitt from 'mitt';
import type { IInputSystem } from '@dcl/ecs';
import { InputAction, PointerEventType } from '@dcl/ecs';

export const globalInputActions = mitt<Record<InputAction, null>>();

export function createInputActionSystem(inputSystem: IInputSystem) {
  return function inputActionSystem() {
    if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) {
      globalInputActions.emit(InputAction.IA_POINTER, null);
    }
    if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
      globalInputActions.emit(InputAction.IA_PRIMARY, null);
    }
    if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
      globalInputActions.emit(InputAction.IA_SECONDARY, null);
    }
  };
}
