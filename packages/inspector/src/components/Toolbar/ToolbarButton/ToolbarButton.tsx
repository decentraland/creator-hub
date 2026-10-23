import React from 'react';
import cx from 'classnames';

import './ToolbarButton.css';

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...rest }, ref) => (
  <button
    ref={ref}
    className={cx('ToolbarButton', className)}
    {...rest}
  />
));

export default React.memo(ToolbarButton);
