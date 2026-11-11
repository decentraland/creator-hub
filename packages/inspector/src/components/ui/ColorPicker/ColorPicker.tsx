import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cx from 'classnames';

import { TextField } from '../TextField';

import { type Props } from './types';

import './ColorPicker.css';

const ColorPicker: React.FC<Props> = ({
  className,
  label,
  disabled,
  value = '#FFFFFF',
  error,
  onChange,
}) => {
  const [color, setColor] = useState<string>(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // the value can change from outside (undo, another entity selected), not only through this picker
  useEffect(() => {
    setColor(value.toString());
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setColor(e.target.value.toUpperCase());
      onChange && onChange(e);
    },
    [setColor, onChange],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);

  const renderLeftContent = useMemo(() => {
    return (
      <div
        className="ColorPreview"
        style={{ backgroundColor: color }}
      />
    );
  }, [color]);

  return (
    <div className={cx('ColorPickerContainer', className, { error, disabled })}>
      <TextField
        className="ColorPickerTextField"
        label={label}
        placeholder="Pick a Color"
        onClick={handleClick}
        value={color}
        error={error}
        disabled={disabled}
        leftContent={renderLeftContent}
        readOnly
      />
      <input
        className="ColorPickerInput"
        type="color"
        ref={inputRef}
        value={color}
        onChange={handleChange}
      />
    </div>
  );
};

export default React.memo(ColorPicker);
