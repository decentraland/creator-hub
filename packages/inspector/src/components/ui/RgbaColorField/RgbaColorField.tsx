import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RgbaColorPicker } from 'react-colorful';

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
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const rgba = color4ToRgba(value);
  const swatchBg = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      setPos({ top: a.bottom + 4, left: Math.max(4, Math.min(a.left, window.innerWidth - 232)) });
    };
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

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
      {open &&
        createPortal(
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
        )}
    </div>
  );
};

export default RgbaColorField;
