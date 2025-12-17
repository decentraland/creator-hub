import type { StatesInput } from './types';

export function sanitize(states: string[]) {
  return states.map($ => $.trim());
}

export function isValidInput(inputs: StatesInput): boolean {
  const set = new Set(sanitize(inputs.value));
  const array = Array.from(set);
  if (array.length !== inputs.value.length) {
    return false;
  }
  if (array.some($ => !$)) {
    return false;
  }
  return true;
}

export function getUniqueState(newState: string, states: string[], attempt = 1) {
  const uniqueState = attempt === 1 ? newState : `${newState} (${attempt})`;
  if (states.includes(uniqueState)) {
    return getUniqueState(newState, states, attempt + 1);
  }
  return uniqueState;
}

export function isRepeated(state: string, states: string[]) {
  return sanitize(states).filter($ => $ === state.trim()).length > 1;
}

export const fromStates = (value: StatesInput): string[] => {
  return value.value ?? [];
};

export const toStates = (items: string[], currentValue: StatesInput): StatesInput => {
  const defaultValue =
    currentValue.defaultValue && items.includes(currentValue.defaultValue)
      ? currentValue.defaultValue
      : items[0];
  return { value: items, defaultValue };
};
