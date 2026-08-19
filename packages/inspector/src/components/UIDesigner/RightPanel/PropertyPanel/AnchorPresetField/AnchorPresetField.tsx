import React from 'react';
import type { Entity } from '@dcl/ecs';

import {
  type AnchorH,
  type AnchorPin,
  type AnchorV,
  anchorPatch,
  readAnchor,
} from '../../../shared/align-presets';
import { measureNodeBox } from '../../../shared/measure';
import { Dropdown } from '../../../../ui';

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

// An axis with no pinned edge gets its own option rather than displaying Left/Top:
// the preview accents no edge for it, so a dropdown reading `Left` would be
// claiming a pin the node does not have. Offered only while the axis reads null —
// once pinned, there is no patch that unpins one axis alone.
const UNPINNED = { value: '', label: 'None' };

export const AnchorPresetField: React.FC<AnchorPresetFieldProps> = ({
  value,
  entity,
  disabled,
  onPatch,
}) => {
  const { h, v } = readAnchor(value);

  const apply = (pin: AnchorPin) => {
    if (disabled) return;
    // The centered pin's counter-margin is half the node's own rendered size.
    const box = measureNodeBox(entity);
    if (!box) return;
    onPatch(anchorPatch(pin, box));
  };

  return (
    <div className="ui-designer-anchor">
      <div className={`ui-designer-anchor-control${disabled ? ' disabled' : ''}`}>
        <div
          className="ui-designer-anchor-preview"
          data-h={h ?? undefined}
          data-v={v ?? undefined}
          aria-hidden="true"
        >
          <span className="ui-designer-anchor-marker" />
        </div>
        <div className="ui-designer-anchor-axes">
          <div className="ui-designer-anchor-axis horizontal">
            <Dropdown
              options={h ? H_OPTIONS : [UNPINNED, ...H_OPTIONS]}
              value={h ?? ''}
              disabled={disabled}
              aria-label="Horizontal anchor"
              onChange={e => {
                const pin = (e.target as HTMLSelectElement).value as AnchorH | '';
                if (pin) apply(pin);
              }}
            />
          </div>
          <div className="ui-designer-anchor-axis vertical">
            <Dropdown
              options={v ? V_OPTIONS : [UNPINNED, ...V_OPTIONS]}
              value={v ?? ''}
              disabled={disabled}
              aria-label="Vertical anchor"
              onChange={e => {
                const pin = (e.target as HTMLSelectElement).value as AnchorV | '';
                if (pin) apply(pin);
              }}
            />
          </div>
        </div>
      </div>
      {disabled ? (
        <span className="ui-designer-anchor-hint">Turn on "Ignore Layout Flow" to anchor</span>
      ) : null}
    </div>
  );
};

export default AnchorPresetField;
