import type { AlertColor } from 'decentraland-ui2';

export type Severity = AlertColor;
export type NotificationId<T extends string> = `${T}_${number}`;
type CustomNotificationType = 'missing-scenes';

type CommonNotificationProps<T extends string> = {
  id: NotificationId<T>;
  type: T;
};

export type CustomNotification = CommonNotificationProps<CustomNotificationType>;
export type GenericNotification = CommonNotificationProps<'generic'> & {
  severity: Severity;
  message: string;
};

export type Notification = CustomNotification | GenericNotification;
