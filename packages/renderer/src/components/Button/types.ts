import type { ButtonOwnProps } from 'decentraland-ui2';

export type ButtonProps = ButtonOwnProps & {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  'data-testid'?: string;
};

export type GroupProps = ButtonProps & {
  extra: React.ReactNode;
};
