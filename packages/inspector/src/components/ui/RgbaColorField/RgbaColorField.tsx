import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RgbaColorPicker } from 'react-colorful';

import { usePopoverPosition } from '../usePopoverPosition';
import { TextField } from '../TextField';
import { type Color4, color4ToRgba, color4ToRgbHex, hexToColor4, rgbaToColor4 } from './color';

import './RgbaColorField.css';

interface RgbaColorFieldProps {
  value: Color4;
  onChange: (c: Color4) => void;
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i;

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

  const commitHex = (raw: string) => {
    const hex = raw.trim();
    if (!HEX.test(hex)) return;
    const parsed = hexToColor4(hex);
    const digits = hex.replace('#', '').length;
    onChange(digits === 8 ? parsed : { ...parsed, a: value.a ?? 1 });
  };

  const commitAlpha = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange({ ...value, a: Math.max(0, Math.min(100, n)) / 100 });
  };

  return (
    <div className="RgbaColorField">
      <button
        ref={anchorRef}
        type="button"
        className="RgbaColorSwatch"
        onClick={() => setOpen(o => !o)}
        aria-label="Pick color"
      >
        <span
          className="RgbaColorSwatchFill"
          style={{ backgroundColor: swatchBg }}
        />
      </button>
      <TextField
        className="RgbaColorHex"
        aria-label="Hex color"
        value={color4ToRgbHex(value)}
        onChange={e => commitHex(e.target.value)}
      />
      <TextField
        className="RgbaColorAlpha"
        type="number"
        aria-label="Opacity percent"
        rightLabel="%"
        value={String(Math.round((value.a ?? 1) * 100))}
        onChange={e => commitAlpha(e.target.value)}
      />
      {open
        ? createPortal(
            <div
              ref={popRef}
              className="RgbaColorPopover"
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
