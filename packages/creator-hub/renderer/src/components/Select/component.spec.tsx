import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { MenuItem } from 'decentraland-ui2';

import { Select } from '.';

describe('Select', () => {
  afterEach(cleanup);

  describe('when the caller passes its own MenuProps', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Select
            value="a"
            MenuProps={{ className: 'CallerMenu' }}
          >
            <MenuItem value="a">A</MenuItem>
          </Select>
        </ThemeProvider>,
      );
      fireEvent.mouseDown(screen.getByRole('combobox'));
    });

    it('should keep both the shared and the caller menu classes', () => {
      const menu = screen.getByRole('listbox').closest('.MuiPopover-root');

      expect(menu?.classList.contains('SelectMenu')).toBe(true);
      expect(menu?.classList.contains('CallerMenu')).toBe(true);
    });

    it('should still leave the page scrollbar alone', () => {
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });
});
