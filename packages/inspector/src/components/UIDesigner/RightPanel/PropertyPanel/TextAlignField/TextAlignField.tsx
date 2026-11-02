import React from 'react';
import {
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdVerticalAlignBottom,
  MdVerticalAlignCenter,
  MdVerticalAlignTop,
} from 'react-icons/md';
import cx from 'classnames';

import { radioGroupKeyDown, radioTabIndex } from '../radio-group';
import { TEXT_ALIGN_MODES, splitTextAlign, textAlignMode } from '../text-align';

import './TextAlignField.css';

interface TextAlignFieldProps {
  value: number | undefined;
  onChange: (mode: number) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  left: <MdFormatAlignLeft aria-hidden />,
  center: <MdFormatAlignCenter aria-hidden />,
  right: <MdFormatAlignRight aria-hidden />,
  top: <MdVerticalAlignTop aria-hidden />,
  middle: <MdVerticalAlignCenter aria-hidden />,
  bottom: <MdVerticalAlignBottom aria-hidden />,
};

const capitalize = (word: string) => `${word[0].toUpperCase()}${word.slice(1)}`;

function AxisGroup<T extends string>({
  label,
  keys,
  current,
  onPick,
}: {
  label: string;
  keys: readonly T[];
  current: T;
  onPick: (key: T) => void;
}) {
  return (
    <div
      className="ui-designer-text-align-group"
      role="radiogroup"
      aria-label={label}
      onKeyDown={radioGroupKeyDown(keys, current, onPick)}
    >
      {keys.map((key, index) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === current}
          aria-label={capitalize(key)}
          title={`${label}: ${key}`}
          tabIndex={radioTabIndex(keys, current, index)}
          className={cx('ui-designer-text-align-cell', { selected: key === current })}
          onClick={() => onPick(key)}
        >
          {ICONS[key]}
        </button>
      ))}
    </div>
  );
}

/** The design's Alignment control: horizontal and vertical 3-cell selectors over the packed `textAlign` enum. */
export const TextAlignField: React.FC<TextAlignFieldProps> = ({ value, onChange }) => {
  const current = splitTextAlign(value);
  return (
    <div className="ui-designer-text-align">
      <AxisGroup
        label="Horizontal alignment"
        keys={TEXT_ALIGN_MODES.horizontal}
        current={current.horizontal}
        onPick={horizontal => onChange(textAlignMode({ ...current, horizontal }))}
      />
      <AxisGroup
        label="Vertical alignment"
        keys={TEXT_ALIGN_MODES.vertical}
        current={current.vertical}
        onPick={vertical => onChange(textAlignMode({ ...current, vertical }))}
      />
    </div>
  );
};

export default TextAlignField;
