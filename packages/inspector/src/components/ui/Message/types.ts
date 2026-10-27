export type Props = {
  text?: React.ReactNode;
  className?: string;
  type?: MessageType;
  icon?: boolean;
  id?: string;
};

export enum MessageType {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  QUESTION = 'question',
}
