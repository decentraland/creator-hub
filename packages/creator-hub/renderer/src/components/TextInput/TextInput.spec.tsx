import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { FormTextInput } from '.';

const outline = () =>
  screen.getByRole('textbox').closest('.MuiInputBase-root')!.querySelector('fieldset')!;

describe('FormTextInput', () => {
  afterEach(cleanup);

  describe('when it is focused', () => {
    it('should draw a 1.5px Snow border and no focus ring', () => {
      render(
        <ThemeProvider theme={dark}>
          <FormTextInput inputProps={{ 'aria-label': 'Name' }} />
        </ThemeProvider>,
      );

      act(() => screen.getByRole('textbox').focus());
      const style = getComputedStyle(outline());

      expect(style.borderTopWidth).toBe('1.5px');
      expect(style.borderTopColor).toBe('#FCFCFC');
      expect(style.boxShadow === '' || style.boxShadow === 'none').toBe(true);
    });
  });
});
