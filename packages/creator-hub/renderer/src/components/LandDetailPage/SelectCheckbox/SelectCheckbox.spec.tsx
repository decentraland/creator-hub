import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { SelectCheckbox } from '.';

const renderBox = (variant: 'primary' | 'secondary') =>
  render(
    <ThemeProvider theme={dark}>
      <SelectCheckbox
        variant={variant}
        indeterminate
        inputProps={{ 'aria-label': 'Select all' }}
      />
    </ThemeProvider>,
  );

describe('SelectCheckbox', () => {
  afterEach(cleanup);

  describe('when the primary box is mixed', () => {
    it('should draw a filled Primary box with a dark 10 × 2 dash', () => {
      renderBox('primary');
      const root = screen.getByRole('checkbox', { name: 'Select all' }).parentElement!;
      const dash = root.querySelector('[data-dash]') as HTMLElement;

      expect(dash).toBeTruthy();
      expect(getComputedStyle(dash).backgroundColor).toBe('#161518');
      expect(getComputedStyle(dash).width).toBe('10px');
      expect(getComputedStyle(dash.parentElement!).backgroundColor).toBe('#FF2D55');
    });
  });
});
