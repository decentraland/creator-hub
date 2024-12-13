import type { ReactNode } from 'react';
import type { ButtonOwnProps } from 'decentraland-ui2';

type Action = { label: string; onClick: () => void };

export type Props = ButtonOwnProps & {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  actions?: Action[];
  actionableIcon?: ReactNode;
};

export type ActionsProps = {
  actions: Action[];
  icon?: ReactNode;
};
