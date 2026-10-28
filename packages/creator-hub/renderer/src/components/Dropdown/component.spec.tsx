import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { useTheme } from 'decentraland-ui2';

import { Dropdown } from '.';

describe('Dropdown', () => {
  afterEach(cleanup);

  describe('when rendered', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Dropdown
            label="Options for Plaza"
            options={[{ text: 'Duplicate', handler: () => {} }]}
          />
        </ThemeProvider>,
      );
    });

    it('should name the trigger and announce a menu', () => {
      const trigger = screen.getByRole('button', { name: 'Options for Plaza' });

      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    });
  });

  describe('when the menu is opened', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Dropdown
            label="Options for Plaza"
            options={[
              { text: 'Duplicate', handler: () => {}, divider: true },
              { text: 'Delete', handler: () => {} },
            ]}
          />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Options for Plaza' }));
    });

    it('should name the menu after its trigger', () => {
      expect(screen.getByRole('menu', { name: 'Options for Plaza' })).toBeTruthy();
    });

    it('should hand focus back to the trigger when Escape closes it', async () => {
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Options for Plaza' }),
        ),
      );
    });

    it('should show the options', () => {
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeTruthy();
    });

    it('should mark the divider as one separator between the options', () => {
      const separators = screen.getAllByRole('separator');

      expect(separators).toHaveLength(1);
      expect(separators[0].previousElementSibling?.textContent).toBe('Duplicate');
    });

    it('should leave the page scrollbar alone, so the layout around the card does not reflow', () => {
      expect(document.body.style.overflow).not.toBe('hidden');
      expect(document.body.style.paddingRight).toBe('');
    });
  });

  describe('when only some options carry a glyph', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Dropdown
            label="Options for Plaza"
            options={[
              { text: 'Copy URL', handler: () => {}, icon: <svg /> },
              { text: 'Permissions', handler: () => {} },
            ]}
          />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Options for Plaza' }));
    });

    it('should give the glyph-less option an empty slot, so every label starts at the same x', () => {
      const permissions = screen.getByRole('menuitem', { name: 'Permissions' });

      expect(permissions.querySelector('.MenuGlyph')?.childElementCount).toBe(0);
    });
  });

  describe('when no option carries a glyph', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Dropdown
            label="Options for Plaza"
            options={[{ text: 'Unpublish', handler: () => {} }]}
          />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Options for Plaza' }));
    });

    it('should render no glyph slot at all', () => {
      expect(
        screen.getByRole('menuitem', { name: 'Unpublish' }).querySelector('.MenuGlyph'),
      ).toBeNull();
    });
  });

  describe('when an option has the danger tone', () => {
    const computedColor = (color: string) => {
      const probe = document.createElement('div');
      probe.style.color = color;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };

    let errorMain = '';
    const ThemeProbe = () => {
      errorMain = useTheme().palette.error.main;
      return null;
    };

    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <ThemeProbe />
          <Dropdown
            label="Options for Plaza"
            options={[
              { text: 'Copy URL', handler: () => {}, icon: <svg data-testid="plain-glyph" /> },
              {
                text: 'Unpublish',
                handler: () => {},
                tone: 'danger',
                icon: <svg data-testid="danger-glyph" />,
              },
            ]}
          />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Options for Plaza' }));
    });

    it('should paint only its glyph in the error colour, leaving its label and the other glyphs alone', () => {
      const error = computedColor(errorMain);

      expect(getComputedStyle(screen.getByTestId('danger-glyph')).color).toBe(error);
      expect(getComputedStyle(screen.getByTestId('plain-glyph')).color).not.toBe(error);
      expect(getComputedStyle(screen.getByRole('menuitem', { name: 'Unpublish' })).color).not.toBe(
        error,
      );
    });
  });

  describe('when the menu is opened with the mouse after earlier keyboard use', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <Dropdown
            label="Options for Plaza"
            options={[
              { text: 'Duplicate', handler: () => {} },
              { text: 'Delete', handler: () => {} },
            ]}
          />
        </ThemeProvider>,
      );
      fireEvent.keyDown(document.body, { key: 'Tab' });
      fireEvent.click(screen.getByRole('button', { name: 'Options for Plaza' }));
    });

    it('should highlight no row until an arrow key moves', () => {
      const menu = screen.getByRole('menu').closest('.MuiPopover-root');

      expect(menu?.classList.contains('ArrowKeyed')).toBe(false);
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      expect(menu?.classList.contains('ArrowKeyed')).toBe(true);
    });
  });
});
