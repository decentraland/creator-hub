import React from 'react';
import type { Entity } from '@dcl/ecs';

import { YGU_PERCENT, YGU_POINT } from '../../../../../lib/sdk/ui-transform-constants';
import { TextField } from '../../../../ui';
import { BindableSubField } from '../BindableSubField';

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
  value: Record<string, unknown> | null;
  componentId: string;
  entity: Entity;
  box: 'padding' | 'margin';
  bindings?: Record<string, string>;
  onPatch: (patch: Record<string, unknown>) => void;
}

/** A 2×2 px edge grid for one `box` (padding or margin) of the UiTransform. */
export const BoxModelField: React.FC<BoxModelFieldProps> = ({
  value,
  componentId,
  entity,
  box,
  bindings,
  onPatch,
}) => {
  const v = value ?? {};
  const group = box === 'padding' ? PADDING : MARGIN;
  const disabled = box === 'margin' && (v.positionType as number | undefined) === 1;
  const isPercent = (path: string) => v[`${path}Unit`] === YGU_PERCENT;

  const write = (path: string, raw: string) => {
    const n = Number(raw);
    onPatch({
      [path]: Number.isFinite(n) ? n : 0,
      [`${path}Unit`]: isPercent(path) ? YGU_PERCENT : YGU_POINT,
    });
  };

  return (
    <div className={`ui-designer-bm-section${disabled ? ' disabled' : ''}`}>
      <div className="ui-designer-bm-grid">
        {group.map(e => (
          <BindableSubField
            key={e.path}
            field={{ componentId, path: e.path, kind: 'length' }}
            entity={entity}
            bound={bindings?.[`${componentId}.${e.path}`]}
          >
            <TextField
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
          </BindableSubField>
        ))}
      </div>
    </div>
  );
};

export default BoxModelField;
