import { type PropsWithChildren } from 'react';
import cx from 'classnames';
import { Popper as DclPopper, ClickAwayListener } from 'decentraland-ui2';

import type { Props } from './types';

import './styles.css';

export function Popper({ open, onClose, children, className, ...props }: PropsWithChildren<Props>) {
  return (
    <ClickAwayListener onClickAway={onClose}>
      <DclPopper
        open={open}
        className={cx('Popper', className)}
        {...props}
      >
        {children}
      </DclPopper>
    </ClickAwayListener>
  );
}
