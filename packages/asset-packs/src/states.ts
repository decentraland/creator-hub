import type { States } from './definitions';

export function isValidState(states: States, value: string | undefined) {
  return !!value && states.value.includes(value);
}

export function getCurrentValue(states: States) {
  if (isValidState(states, states.currentValue)) {
    return states.currentValue!;
  }
  return getDefaultValue(states);
}

export function getDefaultValue(states: States) {
  if (isValidState(states, states.defaultValue)) {
    return states.defaultValue!;
  }
  if (states.value.length > 0) {
    return states.value[0];
  }
}

export function getPreviousValue(states: States) {
  if (isValidState(states, states.previousValue)) {
    return states.previousValue!;
  }
  return null;
}
