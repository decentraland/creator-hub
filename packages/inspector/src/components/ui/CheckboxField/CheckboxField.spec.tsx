import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { InfoTooltip } from '../InfoTooltip';
import { CheckboxField } from '.';

describe('CheckboxField accessible name', () => {
  describe('when it has a label', () => {
    it('should be named by the label', () => {
      render(<CheckboxField label="Loop" />);
      expect(screen.getByRole('checkbox', { name: 'Loop' })).toBeTruthy();
    });

    it('should toggle when the label is clicked', () => {
      const onChange = vi.fn();
      render(
        <CheckboxField
          label="Loop"
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByText('Loop'));
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the caller passes an aria-label', () => {
    it('should be named by the aria-label', () => {
      render(
        <CheckboxField
          label="Loop"
          aria-label="Loop audio"
        />,
      );
      expect(screen.getByRole('checkbox', { name: 'Loop audio' })).toBeTruthy();
    });
  });

  describe('when the caller passes an id', () => {
    it('should keep the id and stay named by the label', () => {
      render(
        <CheckboxField
          id="loop-checkbox"
          label="Loop"
        />,
      );
      expect(screen.getByRole('checkbox', { name: 'Loop' }).id).toBe('loop-checkbox');
    });
  });

  describe('when the label contains an InfoTooltip', () => {
    function renderWithTooltip(onChange: () => void) {
      return render(
        <CheckboxField
          label={
            <>
              Global <InfoTooltip text="Plays everywhere" />
            </>
          }
          onChange={onChange}
        />,
      );
    }

    it('should cancel the tooltip icon click so the label does not activate', () => {
      const { container } = renderWithTooltip(vi.fn());
      const icon = container.querySelector('.InfoTooltipTrigger svg');
      if (!icon) throw new Error('tooltip icon not rendered');
      expect(fireEvent.click(icon)).toBe(false);
    });

    it('should toggle when the label text is clicked', () => {
      const onChange = vi.fn();
      renderWithTooltip(onChange);
      fireEvent.click(screen.getByText('Global'));
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
