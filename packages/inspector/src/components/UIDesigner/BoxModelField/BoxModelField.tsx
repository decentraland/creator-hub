import React from 'react';

import { YGU_POINT } from '../../../lib/sdk/ui-transform-constants';
import { TextField } from '../../ui';

import './BoxModelField.css';

interface Edge {
  path: string;
  label: string;
  mark: string;
}

// T/R/B/L rather than the design's edge icons. `MdBorderTop`/`Right`/`Bottom`/
// `Left` differ only in which single edge of a dotted square is solid, which at
// this size is genuinely unreadable — and the panel already names edges this way
// in the Position vec and the nine-slice control, so the letters are the
// established vocabulary rather than a new one.
const edges = (prefix: 'padding' | 'margin'): Edge[] => [
  { path: `${prefix}Top`, label: `${prefix} top`, mark: 'T' },
  { path: `${prefix}Right`, label: `${prefix} right`, mark: 'R' },
  { path: `${prefix}Bottom`, label: `${prefix} bottom`, mark: 'B' },
  { path: `${prefix}Left`, label: `${prefix} left`, mark: 'L' },
];

const PADDING = edges('padding');
const MARGIN = edges('margin');

interface BoxModelFieldProps {
  // The whole UiTransform value (field uses path '').
  value: Record<string, unknown> | null;
  onPatch: (patch: Record<string, unknown>) => void;
}

// Padding and margin as two icon-labelled 2×2 grids, per the design. Margin is
// greyed out for absolutely-positioned nodes — Yoga ignores it there. Writes the
// flat `<edge>` + `<edge>Unit` px pair.
export const BoxModelField: React.FC<BoxModelFieldProps> = ({ value, onPatch }) => {
  const v = value ?? {};
  const marginDisabled = (v.positionType as number | undefined) === 1;

  const write = (path: string, raw: string) => {
    const n = Number(raw);
    onPatch({ [path]: Number.isFinite(n) ? n : 0, [`${path}Unit`]: YGU_POINT });
  };

  const grid = (label: string, group: Edge[], disabled: boolean) => (
    <div className={`ui-designer-bm-section${disabled ? ' disabled' : ''}`}>
      <span className="ui-designer-bm-tag">{label}</span>
      <div className="ui-designer-bm-grid">
        {group.map(e => (
          <TextField
            key={e.path}
            type="number"
            leftLabel={e.mark}
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
