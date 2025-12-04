import type { Entity } from '@dcl/ecs';
import { getTriggerEvents } from './events';
import { TriggerType } from './enums';

interface DelayAction {
  action: string;
  timeout: number;
  callback: () => void;
}

interface IntervalAction {
  action: string;
  timeout: number;
  interval: number;
  callback: () => void;
}

export const tickSet = new Set<Entity>();

const queueDelay = new Map<Entity, Array<DelayAction>>();
const queueInterval = new Map<Entity, Array<IntervalAction>>();

export function createTimerSystem() {
  return function timerSystem(dt: number) {
    intervalSystem(dt);
    delaySystem(dt);
    tickSystem(dt);
  };

  function intervalSystem(dt: number) {
    for (const [entity, actions] of queueInterval.entries()) {
      const triggerEvents = getTriggerEvents(entity);

      for (const action of actions) {
        if (action.timeout === action.interval) {
          action.callback();
        }

        action.timeout -= dt;

        if (action.timeout <= 0) {
          action.timeout = action.interval;
          triggerEvents.emit(TriggerType.ON_LOOP);
        }
      }
    }
  }

  function delaySystem(dt: number) {
    for (const [entity, actions] of queueDelay.entries()) {
      const triggerEvents = getTriggerEvents(entity);
      const completedActions = [];
      let idx = 0;

      // Iterate entity actions and verify is the timeout is reached to execute the callback
      for (const action of actions) {
        action.timeout -= dt;

        if (action.timeout <= 0) {
          action.callback();
          triggerEvents.emit(TriggerType.ON_DELAY);
          completedActions.push(idx);
        }
        idx++;
      }

      // Remove completed actions from the queue
      for (const action of completedActions) {
        actions.splice(action, 1);
      }
    }
  }

  function tickSystem(_dt: number) {
    for (const entity of tickSet) {
      const triggerEvents = getTriggerEvents(entity);
      triggerEvents.emit(TriggerType.ON_TICK);
    }
  }
}

export function startTimeout(
  entity: Entity,
  action: string,
  timeout: number,
  callback: () => void,
) {
  const actionCallbacks = queueDelay.get(entity) ?? [];
  actionCallbacks.push({ timeout, action, callback });
  queueDelay.set(entity, actionCallbacks);
}

export function stopTimeout(entity: Entity, action: string) {
  const delays = queueDelay.get(entity) ?? [];
  queueDelay.set(
    entity,
    delays.filter($ => $.action !== action),
  );
}

export function stopAllTimeouts(entity: Entity) {
  queueDelay.delete(entity);
}

export function startInterval(
  entity: Entity,
  action: string,
  interval: number,
  callback: () => void,
) {
  const actionCallbacks = queueInterval.get(entity) ?? [];
  actionCallbacks.push({ timeout: interval, action, callback, interval });
  queueInterval.set(entity, actionCallbacks);
}

export function stopInterval(entity: Entity, action: string) {
  const intervals = queueInterval.get(entity) ?? [];
  queueInterval.set(
    entity,
    intervals.filter($ => $.action !== action),
  );
}

export function stopAllIntervals(entity: Entity) {
  queueInterval.delete(entity);
}
