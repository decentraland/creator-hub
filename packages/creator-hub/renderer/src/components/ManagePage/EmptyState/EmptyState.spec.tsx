import type { ButtonHTMLAttributes } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { misc } from '#preload';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { EmptyState } from '.';

vi.mock('../../Button', async importOriginal => ({
  ...(await importOriginal<object>()),
  Button: ({
    variant: _variant,
    color: _color,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; color?: string }) => (
    <button
      type="button"
      {...props}
    />
  ),
}));

const READ_MORE_URL = 'https://docs.decentraland.org/marketplace/land-manager';

describe('EmptyState', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when it carries an info tip and an action', () => {
    const onAction = vi.fn();

    beforeEach(() => {
      render(
        <ThemeProvider theme={dark}>
          <EmptyState
            icon="land"
            title="No LANDs to manage yet"
            info={{ label: 'What is LAND?', text: 'LAND is a token.', readMoreUrl: READ_MORE_URL }}
            description="Rent or buy LAND to publish your scenes."
            action={{ label: 'Rent or Buy LAND', variant: 'primary', onClick: onAction }}
          />
        </ThemeProvider>,
      );
    });

    it('should title the view as a level 2 heading', () => {
      expect(
        screen.getByRole('heading', { level: 2, name: 'No LANDs to manage yet' }),
      ).toBeTruthy();
    });

    it('should run the action from its button', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rent or Buy LAND' }));

      expect(onAction).toHaveBeenCalled();
    });

    describe('and the info button takes focus', () => {
      beforeEach(() => {
        act(() => screen.getByRole('button', { name: 'What is LAND?' }).focus());
      });

      it('should expose the tip as disclosed content, not a tooltip, since it holds a link', () => {
        expect(screen.queryByRole('tooltip')).toBeNull();
      });

      it('should open the tip, with Read More reachable', () => {
        expect(
          screen.getByRole('button', { name: 'What is LAND?' }).getAttribute('aria-expanded'),
        ).toBe('true');
        expect(screen.getByText('LAND is a token.')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Read More →' })).toBeTruthy();
      });

      it('should open Read More outside the app', () => {
        fireEvent.click(screen.getByRole('link', { name: 'Read More →' }));

        expect(misc.openExternal).toHaveBeenCalledWith(READ_MORE_URL);
      });

      describe('and Escape is pressed inside the tip', () => {
        beforeEach(() => {
          const link = screen.getByRole('link', { name: 'Read More →' });
          act(() => link.focus());
          fireEvent.keyDown(link, { key: 'Escape' });
        });

        it('should close it and hand focus back to the info button', () => {
          const button = screen.getByRole('button', { name: 'What is LAND?' });

          expect(button.getAttribute('aria-expanded')).toBe('false');
          expect(document.activeElement).toBe(button);
        });
      });
    });
  });

  describe('when it has only a title', () => {
    it('should render no icon, info, body or button', () => {
      render(
        <ThemeProvider theme={dark}>
          <EmptyState title="No places to display" />
        </ThemeProvider>,
      );

      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.queryByRole('paragraph')).toBeNull();
    });
  });
});
