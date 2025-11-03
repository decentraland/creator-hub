import type { AlertColor } from 'decentraland-ui2';

export type Severity = AlertColor | 'loading';
export type NotificationId = string;
export type CustomNotificationType = { type: 'missing-scenes' };

export type Opts = {
  requestId?: string;
  duration?: number;
};

type CommonNotificationProps<T extends { type: string }> = {
  id: NotificationId;
} & T &
  Opts;

export type CustomNotification = CommonNotificationProps<CustomNotificationType>;
export type GenericNotification = CommonNotificationProps<{ type: 'generic' }> & {
  severity: Severity;
  message: string;
};

export type Notification = CustomNotification | GenericNotification;
