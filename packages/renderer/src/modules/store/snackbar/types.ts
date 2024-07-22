import type { AlertColor } from 'decentraland-ui2';

export type Severity = AlertColor | 'loading';
export type NotificationId = string;
type CustomNotificationType = 'missing-scenes';

export type Opts = {
  requestId?: string;
  duration?: number;
}

type CommonNotificationProps<T extends string> = {
  id: NotificationId;
  type: T;
} & Opts;

export type CustomNotification = CommonNotificationProps<CustomNotificationType>;
export type GenericNotification = CommonNotificationProps<'generic'> & {
  severity: Severity;
  message: string;
};

export type Notification = CustomNotification | GenericNotification;
