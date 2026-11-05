import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { InfoTip } from '.';

function glyphFontSize(size?: 'small' | 'medium') {
  render(
    <ThemeProvider theme={dark}>
      <InfoTip
        label="About this"
        size={size}
      >
        Tip
      </InfoTip>
    </ThemeProvider>,
  );
  const glyph = screen.getByRole('button', { name: 'About this' }).querySelector('svg')!;
  return getComputedStyle(glyph).fontSize;
}

function renderTip() {
  render(
    <ThemeProvider theme={dark}>
      <InfoTip label="About Space Used">Total storage is calculated from your holdings.</InfoTip>
    </ThemeProvider>,
  );
  return screen.getByRole('button', { name: 'About Space Used' });
}

const bubble = () => screen.queryByText('Total storage is calculated from your holdings.');

describe('InfoTip', () => {
  afterEach(cleanup);

  describe('when its glyph is clicked', () => {
    it('should open the tip and keep it open', async () => {
      const glyph = renderTip();

      await act(async () => {
        fireEvent.mouseOver(glyph);
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      await act(async () => {
        fireEvent.mouseDown(glyph);
        fireEvent.mouseUp(glyph);
        fireEvent.click(glyph);
      });

      expect(glyph.getAttribute('aria-expanded')).toBe('true');
      expect(bubble()).toBeTruthy();
    });
  });

  describe('when Escape is pressed on an open tip', () => {
    it('should close it', async () => {
      const glyph = renderTip();
      await act(async () => {
        fireEvent.click(glyph);
      });

      fireEvent.keyDown(glyph, { key: 'Escape' });

      expect(glyph.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('when something outside it is clicked', () => {
    it('should close it', async () => {
      const glyph = renderTip();
      await act(async () => {
        fireEvent.click(glyph);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        fireEvent.click(document.body);
      });

      expect(glyph.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('when no size is given', () => {
    it('should draw the glyph at 16.8px', () => {
      expect(glyphFontSize()).toBe('16.8px');
    });
  });

  describe('when it is small', () => {
    it('should draw the glyph at 13.2px', () => {
      expect(glyphFontSize('small')).toBe('13.2px');
    });
  });
});
