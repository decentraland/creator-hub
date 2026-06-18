import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RgbaColorPicker } from 'react-colorful';

import { usePopoverPosition } from '../usePopoverPosition';
import { type Color4, color4ToRgba, rgbaToColor4 } from './color';

import './RgbaColorField.css';

interface RgbaColorFieldProps {
  value: Color4;
  onChange: (c: Color4) => void;
}

export const RgbaColorField: React.FC<RgbaColorFieldProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const pos = usePopoverPosition({
    anchorRef,
    popoverRef: popRef,
    open,
    onDismiss: dismiss,
    width: 232,
  });

  const rgba = color4ToRgba(value);
  const swatchBg = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;

  return (
    <div className="ui-designer-color-field">
      <button
        ref={anchorRef}
        type="button"
        className="ui-designer-color-swatch"
        onClick={() => setOpen(o => !o)}
        aria-label="Pick color"
      >
        <span
          className="ui-designer-color-swatch-fill"
          style={{ backgroundColor: swatchBg }}
        />
      </button>
      {open
        ? createPortal(
            <div
              ref={popRef}
              className="ui-designer-color-popover"
              style={{ position: 'fixed', top: pos.top, left: pos.left }}
            >
              <RgbaColorPicker
                color={rgba}
                onChange={next => onChange(rgbaToColor4(next))}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default RgbaColorField;
