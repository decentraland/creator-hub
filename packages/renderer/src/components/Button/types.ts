import type { ButtonOwnProps } from 'decentraland-ui2';

export type Props = ButtonOwnProps & {
  className?: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
};
