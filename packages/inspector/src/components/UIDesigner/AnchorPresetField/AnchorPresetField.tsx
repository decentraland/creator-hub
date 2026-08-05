import React from 'react';
import type { Entity } from '@dcl/ecs';

import { type AnchorH, type AnchorV, patchToPreset, presetToPatch } from '../align-presets';
import { measureNodeBox, measureParentBox } from '../measure';
import { Dropdown } from '../../ui';

import './AnchorPresetField.css';

interface AnchorPresetFieldProps {
  // The whole UiTransform value (the field uses path '').
  value: Record<string, unknown> | null;
  entity: Entity;
  disabled?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}

const H_OPTIONS: { value: AnchorH; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const V_OPTIONS: { value: AnchorV; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
];

export const AnchorPresetField: React.FC<AnchorPresetFieldProps> = ({
  value,
  entity,
  disabled,
  onPatch,
}) => {
  const elem = measureNodeBox(entity);
  const parent = measureParentBox(entity);
  const active = !disabled && value && elem && parent ? patchToPreset(value, elem, parent) : null;

  const [v, h] = (active ?? 'top-left').split('-') as [AnchorV, AnchorH];

  const apply = (nextV: AnchorV, nextH: AnchorH) => {
    if (disabled) return;
    const e = measureNodeBox(entity);
    const p = measureParentBox(entity);
    if (!e || !p) return;
    onPatch(presetToPatch(`${nextV}-${nextH}`, e, p));
  };

  return (
    <div className="ui-designer-anchor">
      <div className={`ui-designer-anchor-control${disabled ? ' disabled' : ''}`}>
        <div
          className="ui-designer-anchor-preview"
          data-v={active ? v : undefined}
          data-h={active ? h : undefined}
          aria-hidden="true"
        >
          <span className="ui-designer-anchor-marker" />
        </div>
        <div className="ui-designer-anchor-axes">
          <Dropdown
            options={H_OPTIONS}
            value={h}
            disabled={disabled}
            aria-label="Horizontal anchor"
            onChange={e => apply(v, (e.target as HTMLSelectElement).value as AnchorH)}
          />
          <Dropdown
            options={V_OPTIONS}
            value={v}
            disabled={disabled}
            aria-label="Vertical anchor"
            onChange={e => apply((e.target as HTMLSelectElement).value as AnchorV, h)}
          />
        </div>
      </div>
      {disabled ? (
        <span className="ui-designer-anchor-hint">Turn on "Ignore Layout Flow" to anchor</span>
      ) : null}
    </div>
  );
};

export default AnchorPresetField;
