import React, { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';

import { InfoTooltip } from '../InfoTooltip';
import { Message, MessageType } from '../Message';

import { Props } from './types';

import './TextArea.css';

const TextArea = React.forwardRef<HTMLTextAreaElement, Props>((props, ref) => {
  const { className, disabled, error, label, moreInfo, value, onChange, onFocus, onBlur, ...rest } =
    props;
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
  //   (Same guard as `TextField` — keep the two in sync.)
  useEffect(() => {
    const externalChange = value !== lastValueRef.current;
    lastValueRef.current = value;
    if (isFocused) return;
    if (externalChange && inputValue !== value) {
      setInputValue(value);
    }
  }, [value, isFocused]);

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    event => {
      setInputValue(event.target.value);
      onChange && onChange(event);
    },
    [setInputValue, onChange],
  );

  const handleInputFocus: React.FocusEventHandler<HTMLTextAreaElement> = useCallback(
    event => {
      setFocused(true);
      onFocus && onFocus(event);
    },
    [setFocused, onFocus],
  );

  const handleInputBlur: React.FocusEventHandler<HTMLTextAreaElement> = useCallback(
    event => {
      setFocused(false);
      onBlur && onBlur(event);
    },
    [setFocused, onBlur],
  );

  const handleMouseEnter: React.MouseEventHandler<HTMLTextAreaElement> = useCallback(() => {
    setHovered(true);
  }, [setHovered]);

  const handleMouseLeave: React.MouseEventHandler<HTMLTextAreaElement> = useCallback(() => {
    setHovered(false);
  }, [setHovered]);

  const renderMoreInfo = useCallback(() => {
    if (!moreInfo) {
      return null;
    }

    if (typeof moreInfo === 'string') {
      return (
        <InfoTooltip
          text={moreInfo}
          position="top center"
        />
      );
    }

    return moreInfo;
  }, [moreInfo]);

  return (
    <div
      className={cx('TextArea Field', className, {
        hovered: isHovered,
        focused: isFocused,
        disabled: disabled,
        error: !!error,
      })}
    >
      {label ? (
        <label>
          {label} {renderMoreInfo()}
        </label>
      ) : null}
      <textarea
        ref={ref}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        value={inputValue}
        {...rest}
        className={props.masked && !props.showValue ? 'masked' : ''}
      ></textarea>
      <Message
        text={error}
        type={MessageType.ERROR}
      />
    </div>
  );
});

export default React.memo(TextArea);
