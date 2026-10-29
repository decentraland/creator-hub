import { cleanup, render, screen } from '@testing-library/react';
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

describe('InfoTip', () => {
  afterEach(cleanup);

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
