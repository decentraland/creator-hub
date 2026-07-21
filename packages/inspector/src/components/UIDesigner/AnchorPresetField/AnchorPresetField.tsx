import React from 'react';
import type { Entity } from '@dcl/ecs';

import { ANCHOR_PRESETS, patchToPreset, presetToPatch } from '../align-presets';
import { measureNodeBox, measureParentBox } from '../measure';

import './AnchorPresetField.css';

interface AnchorPresetFieldProps {
  // The whole UiTransform value (the field uses path '').
  value: Record<string, unknown> | null;
  entity: Entity;
  disabled?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}

// 3×3 grid that snaps the node to an absolute pixel position (true corner / edge
// / center placement) computed from the node + parent size. The active cell is
// derived by comparing the node's current Top/Left to those positions. Disabled
// (with a hint) while the node is in flow — anchoring is absolute-only.
export const AnchorPresetField: React.FC<AnchorPresetFieldProps> = ({
  value,
  entity,
  disabled,
  onPatch,
}) => {
  const elem = measureNodeBox(entity);
  const parent = measureParentBox(entity);
  const active = !disabled && value && elem && parent ? patchToPreset(value, elem, parent) : null;

  const apply = (preset: (typeof ANCHOR_PRESETS)[number]) => {
    if (disabled) return;
    const e = measureNodeBox(entity);
    const p = measureParentBox(entity);
    if (!e || !p) return;
    onPatch(presetToPatch(preset, e, p));
  };

  return (
    <div
      className={`ui-designer-anchor-grid${disabled ? ' disabled' : ''}`}
      role="group"
      aria-label="Anchor preset"
    >
      {ANCHOR_PRESETS.map(preset => {
        const label = `Anchor ${preset.replace('-', ' ')}`;
        return (
          <button
            key={preset}
            type="button"
            className={`ui-designer-anchor-cell${preset === active ? ' active' : ''}`}
            aria-label={label}
            aria-pressed={preset === active}
            title={disabled ? 'Switch Positioning to Absolute to anchor' : label}
            disabled={disabled}
            onClick={() => apply(preset)}
          >
            <span
              className="ui-designer-anchor-dot"
              aria-hidden="true"
            />
          </button>
        );
      })}
      {disabled ? (
        <span className="ui-designer-anchor-hint">Switch Positioning to Absolute to anchor</span>
      ) : null}
    </div>
  );
};

export default AnchorPresetField;
