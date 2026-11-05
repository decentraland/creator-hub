import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { Title } from '.';

describe('Title', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when it has a back action', () => {
    it('should be the page heading with a Back button', () => {
      const onBack = vi.fn();
      render(
        <ThemeProvider theme={dark}>
          <Title
            value="Manage - Land Name"
            onBack={onBack}
          />
        </ThemeProvider>,
      );

      expect(screen.getByRole('heading', { level: 1, name: 'Manage - Land Name' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalled();
    });
  });
});
