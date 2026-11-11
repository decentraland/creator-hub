import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { RangeField } from '.';

function slide(step: number, value: string) {
  const onChange = vi.fn();
  const { container } = render(
    <RangeField
      value={0}
      min={0}
      max={1}
      step={step}
      onChange={onChange}
    />,
  );
  const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
  fireEvent.change(slider, { target: { value } });
  return onChange.mock.calls[0][0].target.value;
}

describe('RangeField rounding a slider value', () => {
  describe('when the step has more than 2 decimals', () => {
    it('should keep as many decimals as the step', () => {
      expect(slide(0.0001, '0.0005')).toBe('0.0005');
    });
  });

  describe('when the step has 2 decimals or fewer', () => {
    it('should round to 2 decimals', () => {
      expect(slide(0.1, '0.3')).toBe('0.30');
    });
  });

  describe('when the step is an integer', () => {
    it('should report the integer as is', () => {
      expect(slide(1, '1')).toBe(1);
    });
  });
});
