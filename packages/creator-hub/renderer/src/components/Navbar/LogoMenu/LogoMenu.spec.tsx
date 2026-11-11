import { act, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { feedback, misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { LogoMenu } from '.';

describe('LogoMenu', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  describe('when the user picks Report Bug', () => {
    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <LogoMenu
            onClickAbout={vi.fn()}
            onClickSettings={vi.fn()}
            onClickCheckForUpdates={vi.fn()}
          />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByTestId('logo-menu-button'));
      fireEvent.click(screen.getByTestId('logo-menu-report-bug'));
    });

    it('should open the report dialog instead of the Typeform', () => {
      expect(screen.getByRole('dialog', { name: 'Tell us what went wrong' })).toBeTruthy();
      expect(misc.openExternal).not.toHaveBeenCalled();
    });

    it('should send the report tagged as coming from the logo menu', async () => {
      vi.mocked(feedback.send).mockResolvedValue('sent');
      fireEvent.change(screen.getByRole('textbox', { name: 'What happened?' }), {
        target: { value: 'The app froze' },
      });

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));

      expect(feedback.send).toHaveBeenCalledWith({
        message: 'The app froze',
        email: undefined,
        includeLogs: true,
        associatedEventId: undefined,
        source: 'logo-menu',
      });
    });
  });
});
