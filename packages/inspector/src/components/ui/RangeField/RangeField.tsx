import React, { useCallback, useEffect, useMemo, useState } from 'react';
import cx from 'classnames';

import { MIXED_VALUE, isMixedValue } from '../utils';
import { TextField } from '../TextField';
import { Message, MessageType } from '../Message';
import { Label } from '../Label';

import { type Props } from './types';

import './RangeField.css';

function isFloat(value: any) {
  return Number.isFinite(value) && !Number.isInteger(value);
}

const RangeField = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    label,
    rightLabel,
    error,
    disabled,
    info,
    value = 0,
    min = 0,
    max = 100,
    step = 1,
    isValidValue,
    onChange,
    onBlur,
    ...rest
  } = props;
  const isMixed = isMixedValue(value);
  const [inputValue, setInputValue] = useState(isMixed ? MIXED_VALUE : value);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(isMixedValue(value) ? MIXED_VALUE : value);
    }
  }, [value]);

  const completionPercentage = useMemo(() => {
    if (isMixedValue(inputValue)) {
      // Show slider at 50% for mixed values
      return 50;
    }
    const parsedValue = parseFloat(inputValue.toString()) || 0;
    const parsedMin = parseFloat(min.toString()) || 0;
    const parsedMax = parseFloat(max.toString()) || 100;

    const normalizedValue = Math.min(Math.max(parsedValue, parsedMin), parsedMax);

    return ((normalizedValue - parsedMin) / (parsedMax - parsedMin)) * 100 || 0;
  }, [inputValue, min, max]);

  // Create inline styles for the track with the completion color
  const trackStyle = {
    '--completionPercentage': `${completionPercentage}%`,
  } as any;

  const isValid = useCallback(
    (value: Props['value']) => {
      // Mixed value is always valid (it's a placeholder state)
      if (isMixedValue(value)) {
        return true;
      }

      if (isValidValue) {
        return isValidValue(value);
      }

      // Default validation: value >= min && value <= max
      const parsedValue = parseFloat(value?.toString() || '0');
      const parsedMin = parseFloat(min?.toString() || '0');
      const parsedMax = parseFloat(max?.toString() || '100');

      return parsedValue >= parsedMin && parsedValue <= parsedMax;
    },
    [isValidValue, min, max],
  );

  const formatInput = useCallback(
    (value: Props['value'] = 0) => {
      if (Number.isInteger(Number(value))) {
        return Number(value.toString());
      }
      const decimals = isFloat(step) ? 2 : 0;
      return parseFloat(value.toString()).toFixed(decimals);
    },
    [step],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      const isValidValue = isValid(value);

      const formattedValue = isValidValue ? formatInput(value) : value;

      setInputValue(formattedValue);

      onChange &&
        onChange({
          ...e,
          target: { ...e.target, value: formattedValue },
        } as React.ChangeEvent<HTMLInputElement>);
    },
    [isValid, formatInput, onChange, setInputValue],
  );

  const handleChangeTextField = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
    },
    [setInputValue],
  );

  const handleOnBlur: React.FocusEventHandler<HTMLInputElement> = useCallback(
    e => {
      if (isValid(inputValue)) {
        const formattedValue = formatInput(inputValue);
        onChange &&
          onChange({
            ...e,
            target: { ...e.target, value: formattedValue },
          } as React.ChangeEvent<HTMLInputElement>);
        setInputValue(formattedValue);
        onBlur && onBlur(e);
      }
    },
    [inputValue, setInputValue, formatInput, onChange, isValid],
  );

  const errorMessage = useMemo(() => {
    if (!isValid(inputValue)) {
      return 'Invalid value';
    }
    return undefined;
  }, [inputValue, isValid]);

  const renderMessage = useCallback(() => {
    if (errorMessage) {
      return (
        <Message
          text={errorMessage}
          type={MessageType.ERROR}
        />
      );
    } else if (info) {
      return (
        <Message
          text={info}
          type={MessageType.INFO}
          icon={false}
        />
      );
    }

    return null;
  }, [errorMessage, info]);

  // Calculate a middle value for mixed state slider
  const sliderValue = useMemo(() => {
    if (isMixedValue(inputValue)) {
      const parsedMin = parseFloat(min.toString()) || 0;
      const parsedMax = parseFloat(max.toString()) || 100;
      return (parsedMin + parsedMax) / 2;
    }
    return inputValue;
  }, [inputValue, min, max]);

  return (
    <div className="Range Field">
      <Label text={label} />
      <div className={cx('RangeContainer', { error, disabled, mixed: isMixedValue(inputValue) })}>
        <div className="InputContainer">
          <input
            ref={ref}
            type="range"
            className="RangeInput"
            value={sliderValue}
            min={min}
            max={max}
            step={step}
            style={trackStyle}
            disabled={disabled}
            onChange={handleChange}
            {...rest}
          />
        </div>
        <TextField
          className="RangeTextInput"
          type={isMixedValue(inputValue) ? 'text' : 'number'}
          value={inputValue}
          error={!!errorMessage}
          rightLabel={rightLabel}
          disabled={disabled}
          onChange={handleChangeTextField}
          onBlur={handleOnBlur}
        />
      </div>
      {renderMessage()}
    </div>
  );
});

export default React.memo(RangeField);
