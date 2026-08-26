import React from 'react';

import { type FlowValue, flowPatch, flowValue, isWrapping, wrapPatch } from '../flow';
import { radioGroupKeyDown, radioTabIndex } from '../radio-group';

import './FlowField.css';

interface FlowFieldProps {
  value: Record<string, unknown> | null;
  onPatch: (patch: Record<string, unknown>) => void;
}

const CELLS: { value: FlowValue; label: string; hint: string }[] = [
  {
    value: 'absolute',
    label: 'Absolute',
    hint: 'Absolute — pinned at its own Top/Left offsets, outside the parent’s layout',
  },
  {
    value: 'column',
    label: 'Column',
    hint: 'Column — stack children top to bottom',
  },
  {
    value: 'column-reverse',
    label: 'Column reverse',
    hint: 'Column reverse — stack children bottom to top',
  },
  {
    value: 'row',
    label: 'Row',
    hint: 'Row — lay children out left to right',
  },
  {
    value: 'row-reverse',
    label: 'Row reverse',
    hint: 'Row reverse — lay children out right to left',
  },
];

const CELL_VALUES = CELLS.map(cell => cell.value);

export const FlowField: React.FC<FlowFieldProps> = ({ value, onPatch }) => {
  const current = flowValue(value);
  const wrapping = isWrapping(value);

  const pick = (next: FlowValue) => {
    const patch = flowPatch(next, current, value);
    if (patch) onPatch(patch);
  };

  return (
    <div className="ui-designer-flow">
      <div
        className="ui-designer-flow-group"
        role="radiogroup"
        aria-label="Flow"
        onKeyDown={radioGroupKeyDown(CELL_VALUES, current, pick)}
      >
        {CELLS.map((cell, index) => (
          <button
            key={cell.value}
            type="button"
            role="radio"
            aria-checked={cell.value === current}
            aria-label={cell.label}
            tabIndex={radioTabIndex(CELL_VALUES, current, index)}
            className={`ui-designer-flow-cell${cell.value === current ? ' selected' : ''}`}
            title={cell.hint}
            data-flow={cell.value}
            onClick={() => pick(cell.value)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-pressed={wrapping}
        aria-label="Wrap children"
        className={`ui-designer-flow-cell wrap${wrapping ? ' selected' : ''}`}
        title="Wrap — let children flow onto multiple lines when they do not fit on one"
        data-flow="wrap"
        onClick={() => onPatch(wrapPatch(!wrapping))}
      />
    </div>
  );
};

export default FlowField;
