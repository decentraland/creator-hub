import React from 'react';
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdOpenWith,
  MdWrapText,
} from 'react-icons/md';
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

const CELLS: { value: FlowValue; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    value: 'absolute',
    label: 'Absolute',
    icon: <MdOpenWith aria-hidden />,
    hint: 'Absolute — pinned at its own Top/Left offsets, outside the parent’s layout',
  },
  {
    value: 'column',
    label: 'Column',
    icon: <MdArrowDownward aria-hidden />,
    hint: 'Column — stack children top to bottom',
  },
  {
    value: 'column-reverse',
    label: 'Column reverse',
    icon: <MdArrowUpward aria-hidden />,
    hint: 'Column reverse — stack children bottom to top',
  },
  {
    value: 'row',
    label: 'Row',
    icon: <MdArrowForward aria-hidden />,
    hint: 'Row — lay children out left to right',
  },
  {
    value: 'row-reverse',
    label: 'Row reverse',
    icon: <MdArrowBack aria-hidden />,
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
            onClick={() => pick(cell.value)}
          >
            {cell.icon}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={wrapping}
        aria-label="Wrap children"
        className={`ui-designer-flow-cell wrap${wrapping ? ' selected' : ''}`}
        title="Wrap — let children flow onto multiple lines when they do not fit on one"
        onClick={() => onPatch(wrapPatch(!wrapping))}
      >
        <MdWrapText aria-hidden />
      </button>
    </div>
  );
};

export default FlowField;
