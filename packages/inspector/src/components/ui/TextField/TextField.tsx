import React, { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';

import { debounce } from '../../../lib/utils/debounce';
import { Message, MessageType } from '../Message';
import { Label } from '../Label';
import type { Props } from './types';

import './TextField.css';

function buildBlurEvent(event: React.MouseEvent<HTMLInputElement>) {
  return {
    ...event,
    type: 'blur',
    target: event.target,
    currentTarget: event.currentTarget,
    relatedTarget: null,
  } as unknown as React.FocusEvent<HTMLInputElement>;
}

const TextField = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    className,
    error,
    label,
    leftLabel,
    leftIcon,
    rightLabel,
    rightIcon,
    value,
    disabled,
    leftContent,
    debounceTime,
    onChange,
    onFocus,
    onBlur,
    autoSelect,
    placeholder,
    type = 'text',
    ...rest
  } = props;
  const [inputValue, setInputValue] = useState(value);
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const lastValueRef = useRef(value);

  // Adopt the `value` prop into local state only when it changes from an
  // EXTERNAL source, and never while focused.
  //
  // - Skipping while focused stops a stale `value` (e.g. the engine→input sync
  //   in `useComponentInput`) from overwriting the just-typed character.
  // - Syncing only on an external change (tracked via lastValueRef), rather
  //   than whenever `inputValue !== value`, stops the field from reverting to
  //   a stale prop on blur: after the user edits and blurs, `value` can still
  //   hold the pre-edit value while the onChange→engine→props round-trip is in
  //   flight. The old `inputValue !== value` check fired in that window and
  //   clobbered the committed value — a visible flicker on slow machines, and
  //   the cause of the e2e "rotation reads 0" flake on the CI runner.
  useEffect(() => {
    const externalChange = value !== lastValueRef.current;
    lastValueRef.current = value;
    if (isFocused) return;
    if (externalChange && inputValue !== value) {
      setInputValue(value);
    }
  }, [value, isFocused]);

  const debounceChange = useCallback(debounce(onChange ?? (() => {}), debounceTime ?? 0), [
    debounceTime,
    onChange,
  ]);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    event => {
      setInputValue(event.target.value);
      debounceChange(event);
    },
    [setInputValue, debounceChange],
  );

  const handleInputFocus: React.FocusEventHandler<HTMLInputElement> = useCallback(
    event => {
      setFocused(true);
      if (autoSelect) event.target.select();
      onFocus && onFocus(event);
    },
    [setFocused, onFocus],
  );

  const handleInputBlur: React.FocusEventHandler<HTMLInputElement> = useCallback(
    event => {
      setFocused(false);
      onBlur && onBlur(event);
    },
    [setFocused, onBlur],
  );

  const handleMouseEnter: React.MouseEventHandler = useCallback(() => {
    setHovered(true);
  }, [setHovered]);

  const handleMouseLeave: React.MouseEventHandler = useCallback(() => {
    setHovered(false);
  }, [setHovered]);

  const handleWheel: React.WheelEventHandler<HTMLInputElement> = useCallback(
    event => {
      if (type === 'number') {
        event.stopPropagation();
        event.currentTarget.blur();
        onBlur?.(buildBlurEvent(event));
        return false;
      }
    },
    [type, onBlur],
  );

  const renderLeftContent = useCallback(() => {
    if (leftLabel) {
      return (
        <div className="LeftContent">
          <Label
            className="InputLabel"
            text={leftLabel}
          />
        </div>
      );
    } else if (leftIcon) {
      return (
        <div className="LeftContent">
          <span className="LeftIcon">{leftIcon}</span>
        </div>
      );
    } else if (leftContent) {
      return <div className="LeftContent">{leftContent}</div>;
    }
  }, [leftLabel, leftIcon, leftContent]);

  const renderRightContent = useCallback(() => {
    if (rightLabel) {
      return (
        <div className="RightContent">
          <Label
            className="InputLabel"
            text={rightLabel}
          />
        </div>
      );
    } else if (rightIcon) {
      return (
        <div className="RightContent">
          <span className="RightIcon">{rightIcon}</span>
        </div>
      );
    }
  }, [rightLabel, rightIcon]);

  return (
    <div className={cx('Text Field', className, type)}>
      <Label text={label} />
      <div
        className={cx('InputContainer', {
          hovered: isHovered,
          focused: isFocused,
          disabled: disabled,
          error: !!error,
        })}
      >
        {renderLeftContent()}
        <input
          className="input"
          ref={ref}
          type={inputValue === '--' ? 'text' : type}
          value={inputValue !== '--' ? inputValue : ''}
          placeholder={inputValue === '--' ? '--' : placeholder}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          disabled={disabled}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          {...rest}
        />
        {renderRightContent()}
      </div>
      <Message
        text={error}
        type={MessageType.ERROR}
      />
    </div>
  );
});

export default React.memo(TextField);
