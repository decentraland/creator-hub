import cx from 'classnames';
import { Button } from 'decentraland-ui2';

import type { Props } from './types';

import './styles.css';

export function ButtonComponent({ children, className = '', onClick, ...props }: Props) {
  return (
    <Button {...props} className={cx('Button', className)} onClick={onClick}>
      {children}
    </Button>
  );
}
