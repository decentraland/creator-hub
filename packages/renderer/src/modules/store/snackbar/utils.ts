import type { CustomNotification, GenericNotification, NotificationId, Severity } from './types';

let incrementalId = 0;

function getId<T extends string>(type: T): NotificationId<T> {
  return `${type}_${++incrementalId}`;
}

export function createCustomNotification(type: CustomNotification['type']): CustomNotification {
  return { id: getId(type), type };
}

export function createGenericNotification(
  severity: Severity,
  message: string,
): GenericNotification {
  return { id: getId('generic'), type: 'generic', severity, message };
}
