import React from 'react';

import { YGU_PERCENT, YGU_POINT } from '../../../../../lib/sdk/ui-transform-constants';
import { TextField } from '../../../../ui';

import './BoxModelField.css';

interface Edge {
  path: string;
  label: string;
  glyph: string;
}

const edges = (prefix: 'padding' | 'margin'): Edge[] =>
  (['top', 'right', 'bottom', 'left'] as const).map(side => ({
    path: `${prefix}${side[0].toUpperCase()}${side.slice(1)}`,
    label: `${prefix} ${side}`,
    glyph: `${prefix}-${side}`,
  }));

const PADDING = edges('padding');
const MARGIN = edges('margin');

interface BoxModelFieldProps {
  // The whole UiTransform value (field uses path '').
  value: Record<string, unknown> | null;
  onPatch: (patch: Record<string, unknown>) => void;
}

// Padding and margin as two icon-labelled 2×2 grids, per the design. Margin is
// greyed out for absolutely-positioned nodes — Yoga ignores it there. Writes the
// flat `<edge>` + `<edge>Unit` pair.
//
// There is no unit selector: everything authored here is px, and the in-input
// glyph says so. A PERCENT edge can therefore only be hand-authored — but it
// parses like any other, so it is read back and carried through an edit rather
// than silently reinterpreted as px.
export const BoxModelField: React.FC<BoxModelFieldProps> = ({ value, onPatch }) => {
  const v = value ?? {};
  const marginDisabled = (v.positionType as number | undefined) === 1;
  const isPercent = (path: string) => v[`${path}Unit`] === YGU_PERCENT;

  const write = (path: string, raw: string) => {
    const n = Number(raw);
    onPatch({
      [path]: Number.isFinite(n) ? n : 0,
      [`${path}Unit`]: isPercent(path) ? YGU_PERCENT : YGU_POINT,
    });
  };

  const grid = (label: string, group: Edge[], disabled: boolean) => (
    <div className={`ui-designer-bm-section${disabled ? ' disabled' : ''}`}>
      <span className="ui-designer-bm-tag">{label}</span>
      <div className="ui-designer-bm-grid">
        {group.map(e => (
          <TextField
            key={e.path}
            type="number"
            leftIcon={
              <span
                className="ui-designer-bm-icon"
                data-edge={e.glyph}
                title={e.label}
              />
            }
            rightLabel={isPercent(e.path) ? '%' : 'px'}
            aria-label={e.label}
            title={e.label}
            value={String((v[e.path] as number | undefined) ?? 0)}
            disabled={disabled}
            onChange={ev => write(e.path, ev.target.value)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="ui-designer-bm">
      {grid('Padding', PADDING, false)}
      {grid('Margin', MARGIN, marginDisabled)}
    </div>
  );
};

export default BoxModelField;
