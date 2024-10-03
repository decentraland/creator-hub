import type { AlertColor } from 'decentraland-ui2';
import type { Project } from '/shared/types/projects';

export type Severity = AlertColor | 'loading';
export type NotificationId = string;
type CustomNotificationType =
  | 'missing-scenes'
  | 'new-dependency-version'
  | 'dependency-updated-automatically';

export type Opts = {
  requestId?: string;
  duration?: number;
  project?: Project;
};

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
