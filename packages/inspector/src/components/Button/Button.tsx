import cx from 'classnames';

import type { PropTypes } from './types';
import './Button.css';

function Button({
  variant = 'text',
  color = 'primary',
  size = 'medium',
  className,
  children,
  ...props
}: PropTypes) {
  return (
    <button
      {...props}
      className={cx(
        'Button',
        variant !== 'contained' && variant,
        color !== 'secondary' && color,
        size !== 'small' && size,
        className,
      )}
    >
      {children}
    </button>
  );
}

export default Button;
