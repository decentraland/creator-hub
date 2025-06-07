import type { Action } from '@reduxjs/toolkit';
import { type GetState } from '#store';

export type WindowWithAnalytics = Window & {
  analytics: SegmentAnalytics.AnalyticsJS;
};

export type EventName = string | ((action: Action) => string);

export interface AnalyticsAction<
  A extends TypedActionCreator<string> = TypedActionCreator<string>,
> {
  eventName: EventName;
  actionType: Action['type'];
  getPayload?: GetPayload<A>;
}

export interface TypedActionCreator<Type extends string> {
  (...args: any[]): Action<Type>;
  type: Type;
}

export type GetPayload<A extends TypedActionCreator<string>> = (
  action: ReturnType<A>,
  getState: GetState,
) => Promise<Record<string, string | number | undefined | null>>;
