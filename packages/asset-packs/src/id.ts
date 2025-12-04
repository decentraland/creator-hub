import type {
  ComponentDefinition,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
} from '@dcl/ecs';
import type { Counter } from './definitions';
import { ComponentName } from './definitions';

export const COMPONENTS_WITH_ID: string[] = [
  ComponentName.ACTIONS,
  ComponentName.STATES,
  ComponentName.COUNTER,
];

export function getCounterComponent(engine: IEngine) {
  return engine.getComponent(
    ComponentName.COUNTER,
  ) as LastWriteWinElementSetComponentDefinition<Counter>;
}

export function getNextId(engine: IEngine) {
  const Counter = getCounterComponent(engine);
  const counter = Counter.getOrCreateMutable(engine.RootEntity);
  return ++counter.value;
}

export function requiresId<T extends { id: string }>(
  component: ComponentDefinition<unknown>,
): component is ComponentDefinition<T> {
  return COMPONENTS_WITH_ID.includes(component.componentName);
}
