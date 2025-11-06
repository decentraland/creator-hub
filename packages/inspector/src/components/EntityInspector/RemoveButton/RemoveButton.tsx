import { type HTMLAttributes, memo } from 'react';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { Button } from '../../Button';
import './RemoveButton.css';

interface RemoveButtonProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'add';
}

const RemoveButton = memo<RemoveButtonProps>(props => {
  const { children, variant = 'default', className, ...rest } = props;

  if (variant === 'add') {
    return (
      <button
        className={cx('RemoveButton', 'RemoveButton--add', className)}
        {...rest}
      >
        <RemoveIcon /> {children}
      </button>
    );
  }

  return (
    <Button
      className={cx('RemoveButton', className)}
      {...rest}
    >
      <RemoveIcon /> {children}
    </Button>
  );
});

export default RemoveButton;
