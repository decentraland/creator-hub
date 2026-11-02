import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import type * as WorldsModule from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../tests/utils/testStore';
import { UnpublishWorldModal } from './UnpublishWorldModal';

const unpublishEntireWorld = vi.fn();

vi.mock('/@/lib/worlds', async importOriginal => ({
  ...(await importOriginal<typeof WorldsModule>()),
  Worlds: class {
    unpublishEntireWorld = unpublishEntireWorld;
  },
}));
vi.mock('/@/lib/auth', async importOriginal => ({
  ...(await importOriginal<object>()),
  AuthServerProvider: { getAccount: () => '0xme' },
}));
vi.mock('../../Button', async importOriginal => ({
  ...(await importOriginal<object>()),
  Button: ({
    color: _color,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) => (
    <button
      type="button"
      {...props}
    />
  ),
}));
vi.mock('../../Modals', () => ({
  Modal: ({
    open,
    children,
    actions,
  }: {
    open: boolean;
    children: ReactNode;
    actions: ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        {actions}
      </div>
    ) : null,
}));

describe('UnpublishWorldModal', () => {
  beforeAll(() => setCurrentLocale('en', flatten(en)));
  afterEach(() => {
    cleanup();
    unpublishEntireWorld.mockReset();
  });

  it('should stay open and stop loading when unpublishing fails', async () => {
    unpublishEntireWorld.mockRejectedValue(new Error('Unavailable'));
    const onClose = vi.fn();
    render(
      <Provider store={createTestStore() as never}>
        <ThemeProvider theme={dark}>
          <UnpublishWorldModal
            worldName="plaza.dcl.eth"
            onClose={onClose}
          />
        </ThemeProvider>
      </Provider>,
    );

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' })));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
