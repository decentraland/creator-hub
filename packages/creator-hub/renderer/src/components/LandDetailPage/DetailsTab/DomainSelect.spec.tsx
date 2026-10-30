import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { MenuItem } from 'decentraland-ui2';

import { DomainSelect } from './DetailsTab.styled';

const focusVisibleRules = () =>
  [...document.querySelectorAll('style')]
    .flatMap(style => (style.textContent ?? '').split('}'))
    .filter(rule => rule.includes(':focus-visible'));

describe('DomainSelect', () => {
  afterEach(cleanup);

  describe('when it takes focus', () => {
    it('should draw a Snow border, and no keyboard focus ring', async () => {
      render(
        <ThemeProvider theme={dark}>
          <DomainSelect
            value="plaza"
            inputProps={{ 'aria-label': 'Domain' }}
          >
            <MenuItem value="plaza">plaza.dcl.eth</MenuItem>
          </DomainSelect>
        </ThemeProvider>,
      );
      const combobox = screen.getByRole('combobox', { name: 'Domain' });

      await act(async () => combobox.focus());

      const fieldset = combobox.closest('.MuiInputBase-root')!.querySelector('fieldset')!;
      expect(getComputedStyle(fieldset).borderTopColor).toBe('#FCFCFC');
      expect(focusVisibleRules().filter(rule => /63B4F6|99, ?180, ?246/i.test(rule))).toEqual([]);
    });
  });
});
