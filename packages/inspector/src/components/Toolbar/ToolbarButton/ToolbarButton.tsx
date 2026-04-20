import React from 'react';
import cx from 'classnames';

import './ToolbarButton.css';

type ToolbarButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  'data-shortcut'?: string;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  className,
  title,
  disabled,
  children,
  'data-shortcut': shortcut,
  ...rest
}) => {
  return (
    <button
      className={cx('ToolbarButton', className)}
      data-tooltip={disabled ? undefined : title}
      data-shortcut={shortcut}
      disabled={disabled}
      data-position="right center"
      data-inverted
      {...rest}
    >
      {children}
      {shortcut && title && (
        <span className="ToolbarButton-tooltip">
          <span className="tooltip-title">{title}</span>
          <span className="tooltip-shortcut">{shortcut}</span>
        </span>
      )}
    </button>
  );
};

export default React.memo(ToolbarButton);
