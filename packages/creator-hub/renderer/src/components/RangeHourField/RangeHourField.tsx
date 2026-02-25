import React, { useCallback, useEffect, useMemo, useState, type InputHTMLAttributes } from 'react';
import cx from 'classnames';
import './RangeHourField.css';

const MIN_SECONDS = 0;
const STEP_SECONDS = 60;
const MAX_SECONDS = 86340; // 23:59 in seconds
export const MIDDAY_SECONDS = 43200; // 12:00 in seconds
export const MIDNIGHT_SECONDS = 86400; // 24:00 in seconds

function formatHour(value: number): string {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const RangeHourField = React.memo(
  React.forwardRef<HTMLInputElement, Props>((props, ref) => {
    const { disabled, value = 0, onChange, ...rest } = props;

    const [time, setTime] = useState({
      timeInSeconds: Number(value),
      timeInHHMM: formatHour(Number(value)),
    });

    useEffect(() => {
      const numValue = Number(value);
      if (numValue !== time.timeInSeconds) {
        setTime({
          timeInSeconds: numValue,
          timeInHHMM: formatHour(numValue),
        });
      }
    }, [value]);

    const completionPercentage = useMemo(() => {
      const normalizedValue = Math.min(Math.max(time.timeInSeconds, MIN_SECONDS), MAX_SECONDS);
      return ((normalizedValue - MIN_SECONDS) / (MAX_SECONDS - MIN_SECONDS)) * 100 || 0;
    }, [time.timeInSeconds]);

    const trackStyle = {
      '--completionPercentage': `${completionPercentage}%`,
    } as any;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = parseFloat(e.target.value);
        const valueToSend = numValue === MIN_SECONDS ? MIDNIGHT_SECONDS : numValue;
        setTime({
          timeInSeconds: numValue,
          timeInHHMM: formatHour(numValue),
        });
        onChange &&
          onChange({
            ...e,
            target: { ...e.target, value: valueToSend.toString() },
          } as React.ChangeEvent<HTMLInputElement>);
      },
      [onChange],
    );

    const parseTimeInput = useCallback((timeStr: string): number => {
      const [hours = '0', minutes = '0'] = timeStr.split(':');
      const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60;
      // When input is 00:00, send MIDNIGHT_SECONDS (86400)
      return totalSeconds === 0 ? MIDNIGHT_SECONDS : totalSeconds;
    }, []);

    const handleChangeTextField = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        const seconds = parseTimeInput(inputValue);
        // When input is 00:00, send MIDNIGHT_SECONDS (86400)
        const valueToSend = seconds === MIN_SECONDS ? MIDNIGHT_SECONDS : seconds;
        setTime({
          timeInSeconds: seconds,
          timeInHHMM: inputValue,
        });
        onChange &&
          onChange({
            ...e,
            target: { ...e.target, value: valueToSend.toString() },
          } as React.ChangeEvent<HTMLInputElement>);
      },
      [onChange, parseTimeInput],
    );

    return (
      <div className="Range Field RangeHour">
        <div className={cx('RangeContainer', { disabled })}>
          <div className="InputContainer">
            <input
              ref={ref}
              type="range"
              className="RangeInput"
              min={MIN_SECONDS}
              max={MAX_SECONDS}
              step={STEP_SECONDS}
              value={time.timeInSeconds}
              style={trackStyle}
              disabled={disabled}
              onChange={handleChange}
              {...rest}
            />
          </div>
          <input
            className="RangeTextInput"
            type="time"
            value={time.timeInHHMM}
            disabled={disabled}
            onChange={handleChangeTextField}
            onBlur={handleChangeTextField}
          />
        </div>
      </div>
    );
  }),
);

export { RangeHourField };
