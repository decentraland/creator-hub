import type { CustomNotification, GenericNotification, NotificationId, Severity, Opts } from './types';

let incrementalId = 0;

function getId(type: string): NotificationId {
  return `${type}_${++incrementalId}`;
}

export function createCustomNotification(type: CustomNotification['type'], opts?: Opts): CustomNotification {
  return { ...opts, id: opts?.requestId || getId(type), type };
}

export function createGenericNotification(
  severity: Severity,
  message: string,
  opts?: Opts,
): GenericNotification {
  return { ...opts, id: opts?.requestId || getId('generic'), type: 'generic', severity, message };
}
