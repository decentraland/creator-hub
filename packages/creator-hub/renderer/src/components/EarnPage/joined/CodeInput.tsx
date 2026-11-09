import { useEffect, useRef } from 'react';

import { t } from '/@/modules/store/translation/utils';

import { CodeBox, CodeRow } from './PayoutModals.styled';

const LENGTH = 6;

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

/** Six empty digits. */
export const EMPTY_CODE: readonly string[] = Array.from({ length: LENGTH }, () => '');

/**
 * A six-digit one-time code, one box per digit, the first focused on mount: typing moves on,
 * Backspace on an empty box moves back, the arrow keys move between boxes, and a paste spreads
 * its digits from the box it lands in.
 * @param props.labelledBy - the id naming the group of boxes.
 * @param props.describedBy - the id of the line describing the code, e.g. its error.
 */
export function CodeInput({
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid = false,
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (index: number) => boxes.current[Math.min(Math.max(index, 0), LENGTH - 1)]?.focus();

  useEffect(() => focus(0), []);

  const fill = (from: number, digits: string) => {
    const next = [...value];
    [...digits].slice(0, LENGTH - from).forEach((digit, offset) => (next[from + offset] = digit));
    onChange(next);
    focus(from + digits.length);
  };

  return (
    <CodeRow
      role="group"
      aria-labelledby={labelledBy}
    >
      {value.map((digit, index) => (
        <CodeBox
          key={index}
          ref={element => {
            boxes.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={t('earn.joined.payouts.verify.digit', { n: index + 1 })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          data-filled={digit ? 'true' : undefined}
          onChange={event => {
            const typed = event.target.value.replace(/\D/g, '').slice(-1);
            if (typed) fill(index, typed);
            else if (!event.target.value)
              onChange(value.map((old, at) => (at === index ? '' : old)));
          }}
          onFocus={event => event.target.select()}
          onKeyDown={event => {
            if (event.key in STEP) {
              event.preventDefault();
              focus(index + STEP[event.key]);
            } else if (event.key === 'Backspace' && !digit) focus(index - 1);
          }}
          onPaste={event => {
            event.preventDefault();
            const digits = event.clipboardData.getData('text').replace(/\D/g, '');
            if (digits) fill(index, digits);
          }}
        />
      ))}
    </CodeRow>
  );
}
