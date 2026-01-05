import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';
import { Message, MessageType } from '../Message';
import { Label } from '../Label';
import { isMixedValue } from '../utils';
import { type Props } from './types';

import './CheckboxField.css';

const CheckboxField = React.forwardRef<HTMLInputElement, Props>((props, forwardedRef) => {
  const {
    className,
    checked,
    label,
    error,
    disabled,
    onChange,
    type = 'checkbox',
    value,
    ...rest
  } = props;

  // Detect indeterminate state from mixed value
  const isIndeterminate = useMemo(() => isMixedValue(value), [value]);

  // Set ref and indeterminate property in a single callback
  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node) {
        node.indeterminate = isIndeterminate;
      }
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef, isIndeterminate],
  );

  return (
    <div className={cx('Checkbox Field', className, { disabled: disabled })}>
      <div
        className={cx('InputContainer', {
          disabled: disabled,
          error: !!error,
          indeterminate: isIndeterminate,
        })}
      >
        <input
          type={type}
          ref={setRef}
          checked={isIndeterminate ? false : !!checked}
          onChange={onChange}
          disabled={disabled}
          {...rest}
        />
        <Label text={label} />
      </div>
      <Message
        text={error}
        type={MessageType.ERROR}
      />
    </div>
  );
});

export default React.memo(CheckboxField);
