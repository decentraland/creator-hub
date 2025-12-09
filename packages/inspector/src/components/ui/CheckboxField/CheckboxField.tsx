import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  const [inputValue, setInputValue] = useState(checked);

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

  useEffect(() => {
    setInputValue(checked);
  }, [checked]);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    event => {
      setInputValue(event.target.checked);
      onChange && onChange(event);
    },
    [setInputValue, onChange],
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
          checked={isIndeterminate ? false : !!inputValue}
          onChange={handleInputChange}
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
