import { type PropsWithChildren } from 'react';
import { Popper as _Popper, ClickAwayListener } from 'decentraland-ui2';
import cx from 'classnames';

import type { Props } from './types';

import './styles.css';

export function Popper({ open, onClose, children, className, ...props }: PropsWithChildren<Props>) {
  return (
    <ClickAwayListener onClickAway={onClose}>
      <_Popper
        open={open}
        className={cx('Popper', className)}
        {...props}
      >
        {children}
      </_Popper>
    </ClickAwayListener>
  );
}
