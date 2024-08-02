import type { Action } from '@reduxjs/toolkit';
import type {
  AnalyticsAction,
  EventName,
  GetPayload,
  TypedActionCreator,
  WindowWithAnalytics,
} from './types';

export const trackedActions: Record<string, AnalyticsAction> = {};
const hashedProps = ['project_path'];

export const hash = async (text: string) => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 32);
};

export async function track(
  event: string,
  payload: Record<string, string | number | undefined | null>,
) {
  const analytics = getAnalytics();
  if (!analytics) return;
  if (typeof payload === 'object') {
    for (const key in payload) {
      if (hashedProps.includes(key) && typeof payload[key] === 'string') {
        payload[key] = await hash(payload[key]);
      }
    }
  }
  console.log('TRACKABOLA', payload);
  analytics.track(event, payload);
}

export async function handleAction(action: Action) {
  console.log('handleAction', action);

  if (isActionTrackable(action)) {
    const { eventName, getPayload } = trackedActions[action.type];

    let event = action.type;
    if (typeof eventName === 'string') {
      event = eventName;
    } else {
      event = eventName(action);
    }

    const payload = await getPayload(action);

    track(event, payload);
  }
}

export function trackAction<ActionCreator extends TypedActionCreator<string>>(
  actionCreator: ActionCreator,
  eventName: EventName,
  getPayload: GetPayload<ActionCreator>,
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
