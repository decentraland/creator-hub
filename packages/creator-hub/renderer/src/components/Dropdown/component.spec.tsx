import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { Dropdown } from '.';

describe('Dropdown', () => {
  afterEach(cleanup);

  describe('when the menu is opened', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Dropdown options={[{ text: 'Duplicate', handler: () => {} }]} />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByRole('button'));
    });

    it('should show the options', () => {
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeTruthy();
    });

    it('should leave the page scrollbar alone, so the layout around the card does not reflow', () => {
      expect(document.body.style.overflow).not.toBe('hidden');
      expect(document.body.style.paddingRight).toBe('');
    });
  });
});
