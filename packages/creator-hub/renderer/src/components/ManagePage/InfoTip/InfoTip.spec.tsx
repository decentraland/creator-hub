import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { InfoTip } from '.';

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
});
