import React from 'react';
import type { Entity } from '@dcl/ecs';

import { type FlowValue, flowPatch, flowValue, isWrapping, wrapPatch } from '../flow';
import { measureNodeOffset } from '../measure';

import './FlowField.css';

interface FlowFieldProps {
  // The whole UiTransform value (the field uses path '').
  value: Record<string, unknown> | null;
  entity: Entity;
  onPatch: (patch: Record<string, unknown>) => void;
}

// The glyph per cell is a CSS mask keyed off `data-flow`, so a cell renders no
// child of its own — see FlowField.css.
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

// One exclusive selector over `positionType` + `flexDirection`, plus a separate
// wrap toggle. See flow.ts for why the two props share a control and why
// `absolute` never clears the direction.
export const FlowField: React.FC<FlowFieldProps> = ({ value, entity, onPatch }) => {
  const current = flowValue(value);
  const wrapping = isWrapping(value);

  const pick = (next: FlowValue) => {
    const patch = flowPatch(next, current, measureNodeOffset(entity), value);
    if (patch) onPatch(patch);
  };

  return (
    <div className="ui-designer-flow">
      <div
        className="ui-designer-flow-group"
        role="radiogroup"
        aria-label="Flow"
      >
        {CELLS.map(cell => (
          <button
            key={cell.value}
            type="button"
            role="radio"
            aria-checked={cell.value === current}
            aria-label={cell.label}
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
