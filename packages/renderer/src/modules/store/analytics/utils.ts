import type { Action } from '@reduxjs/toolkit';
import type {
  AnalyticsAction,
  EventName,
  GetPayload,
  TypedActionCreator,
  WindowWithAnalytics,
} from './types';
import { analytics } from '#preload';
import { store } from '#store';

export const trackedActions: Record<string, AnalyticsAction> = {};

export async function handleAction(action: Action) {
  if (isActionTrackable(action)) {
    const { eventName, getPayload } = trackedActions[action.type];

    let event = action.type;
    if (typeof eventName === 'string') {
      event = eventName;
    } else {
      event = eventName(action);
    }

    const payload = getPayload ? await getPayload(action, store.getState) : undefined;

    await analytics.track(event, payload);
  }
}

export function trackAction<ActionCreator extends TypedActionCreator<string>>(
  actionCreator: ActionCreator,
  eventName: EventName,
  getPayload?: GetPayload<ActionCreator>,
) {
  if (actionCreator.type in trackedActions) {
    console.warn(`Analytics: the action type "${actionCreator.type}" is already being tracked!`);
    return;
  }
  trackedActions[actionCreator.type] = {
    actionType: actionCreator.type,
    eventName,
    getPayload,
  };
}

export function isActionTrackable(action: Action) {
  if (action && action.type) {
    return action.type in trackedActions;
  }
  console.warn(`Analytics: invalid action "${JSON.stringify(action)}"`);
  return false;
}

export function getAnalytics() {
  return (window as WindowWithAnalytics).analytics;
}
