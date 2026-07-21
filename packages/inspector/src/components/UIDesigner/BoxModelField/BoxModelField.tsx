import React from 'react';

import './BoxModelField.css';

type Edge = 'top' | 'right' | 'bottom' | 'left';

const MARGINS: { path: string; pos: Edge }[] = [
  { path: 'marginTop', pos: 'top' },
  { path: 'marginRight', pos: 'right' },
  { path: 'marginBottom', pos: 'bottom' },
  { path: 'marginLeft', pos: 'left' },
];

const PADDINGS: { path: string; pos: Edge }[] = [
  { path: 'paddingTop', pos: 'top' },
  { path: 'paddingRight', pos: 'right' },
  { path: 'paddingBottom', pos: 'bottom' },
  { path: 'paddingLeft', pos: 'left' },
];

const YGU_POINT = 1; // px

interface BoxModelFieldProps {
  // The whole UiTransform value (field uses path '').
  value: Record<string, unknown> | null;
  onPatch: (patch: Record<string, unknown>) => void;
}

// CSS-devtools / Unity-style box model: a margin ring wrapping a padding ring
// wrapping the content, with the 8 px values editable on their edges. Margin is
// greyed out for absolutely-positioned nodes (Yoga ignores it), matching the old
// `disabledWhen`. Writes the flat `<edge>` + `<edge>Unit` px pair like quad-pixels.
export const BoxModelField: React.FC<BoxModelFieldProps> = ({ value, onPatch }) => {
  const v = value ?? {};
  const marginDisabled = (v.positionType as number | undefined) === 1;

  const read = (path: string) => String((v[path] as number | undefined) ?? 0);
  const write = (path: string, raw: string) => {
    const n = Number(raw);
    onPatch({ [path]: Number.isFinite(n) ? n : 0, [`${path}Unit`]: YGU_POINT });
  };
  const labelFor = (path: string) => path.replace(/([A-Z])/g, ' $1').toLowerCase();

  const edge = (path: string, pos: Edge, disabled: boolean) => (
    <input
      key={path}
      type="number"
      inputMode="numeric"
      className={`ui-designer-bm-edge ui-designer-bm-${pos}`}
      aria-label={labelFor(path)}
      title={labelFor(path)}
      value={read(path)}
      disabled={disabled}
      onChange={e => write(path, e.target.value)}
    />
  );

  return (
    <div className={`ui-designer-bm-box ui-designer-bm-margin${marginDisabled ? ' disabled' : ''}`}>
      <span className="ui-designer-bm-tag">margin</span>
      {MARGINS.map(m => edge(m.path, m.pos, marginDisabled))}
      <div className="ui-designer-bm-box ui-designer-bm-padding">
        <span className="ui-designer-bm-tag">padding</span>
        {PADDINGS.map(p => edge(p.path, p.pos, false))}
        <div className="ui-designer-bm-content">content</div>
      </div>
    </div>
  );
};

export default BoxModelField;
