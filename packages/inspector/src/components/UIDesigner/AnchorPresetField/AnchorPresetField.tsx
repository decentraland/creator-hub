import React from 'react';
import type { Entity } from '@dcl/ecs';

import { ANCHOR_PRESETS, patchToPreset, presetToPatch } from '../align-presets';
import { measureNodeBox, measureParentBox } from '../measure';

import './AnchorPresetField.css';

interface AnchorPresetFieldProps {
  // The whole UiTransform value (the field uses path '').
  value: Record<string, unknown> | null;
  entity: Entity;
  onPatch: (patch: Record<string, unknown>) => void;
}

// 3×3 grid that snaps the node to an absolute pixel position (true corner / edge
// / center placement) computed from the node + parent size. The active cell is
// derived by comparing the node's current Top/Left to those positions.
export const AnchorPresetField: React.FC<AnchorPresetFieldProps> = ({ value, entity, onPatch }) => {
  const elem = measureNodeBox(entity);
  const parent = measureParentBox(entity);
  const active = value && elem && parent ? patchToPreset(value, elem, parent) : null;

  const apply = (preset: (typeof ANCHOR_PRESETS)[number]) => {
    const e = measureNodeBox(entity);
    const p = measureParentBox(entity);
    if (!e || !p) return;
    onPatch(presetToPatch(preset, e, p));
  };

  return (
    <div
      className="ui-designer-anchor-grid"
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
            title={label}
            onClick={() => apply(preset)}
          >
            <span
              className="ui-designer-anchor-dot"
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
};

export default AnchorPresetField;
