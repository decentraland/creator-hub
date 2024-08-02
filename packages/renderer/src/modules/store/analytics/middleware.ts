import type { Action, Middleware } from '@reduxjs/toolkit';
import { getAnalytics, handleAction } from './utils';
import './snippet';
import './track';

const disabledMiddleware: Middleware = _store => next => action => {
  next(action);
};

export function createAnalyticsMiddleware(apiKey?: string): Middleware {
  if (!apiKey) {
    console.warn('Analytics: middleware disabled due to missing API key');
    return disabledMiddleware;
  }

  const analytics = getAnalytics();
  if (!analytics) {
    console.warn('Analytics: middleware disabled because `window.analytics` is not present');
    return disabledMiddleware;
  }

  analytics.load(apiKey);

  return _store => next => action => {
    void handleAction(action as Action);
    next(action);
  };
}
