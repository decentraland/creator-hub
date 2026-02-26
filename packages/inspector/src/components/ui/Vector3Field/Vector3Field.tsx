import React from 'react';
import type { Vector3 } from '@dcl/sdk/math';
import { TextField } from '../TextField';

export type Vector3FieldProps = {
  value: Vector3;
  onChange: (axis: keyof Vector3, value: number) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  disabled?: boolean;
};

const AXES = ['x', 'y', 'z'] as const;

const Vector3Field: React.FC<Vector3FieldProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  disabled,
}) => {
  return (
    <>
      {AXES.map(axis => (
        <TextField
          key={axis}
          leftLabel={axis.toUpperCase()}
          type="number"
          value={value[axis]}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={event => {
            const parsed = parseFloat(event.target.value);
            if (!isNaN(parsed)) onChange(axis, parsed);
          }}
          disabled={disabled}
          autoSelect
        />
      ))}
    </>
  );
};

export default React.memo(Vector3Field);
