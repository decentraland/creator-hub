import type { DeepReadonlyObject } from '@dcl/ecs';
import type { States } from './definitions';

type ReadonlyStates = DeepReadonlyObject<States>;

export function isValidState(states: ReadonlyStates, value: string | undefined) {
  return !!value && states.value.includes(value);
}

export function getCurrentValue(states: ReadonlyStates) {
  if (isValidState(states, states.currentValue)) {
    return states.currentValue!;
  }
  return getDefaultValue(states);
}

export function getDefaultValue(states: ReadonlyStates) {
  if (isValidState(states, states.defaultValue)) {
    return states.defaultValue!;
  }
  if (states.value.length > 0) {
    return states.value[0];
  }
}

export function getPreviousValue(states: ReadonlyStates) {
  if (isValidState(states, states.previousValue)) {
    return states.previousValue!;
  }
  return null;
}
