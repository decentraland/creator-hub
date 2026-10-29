import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { useAuth } from '/@/hooks/useAuth';
import type * as WorldsModule from '/@/lib/worlds';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { createTestStore } from '../../../../../tests/utils/testStore';
import { AccessSection } from '.';

const OWNER = '0x00000000000000000000000000000000000000a1';
const COLLABORATOR = '0x00000000000000000000000000000000000000b2';
const GUEST = '0x00000000000000000000000000000000000000c3';
const NEWCOMER = '0x00000000000000000000000000000000000000d4';
const CLUB = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

const api = {
  getPermissions: vi.fn(),
  postPermissionType: vi.fn(),
  putPermissionType: vi.fn(),
  deletePermissionType: vi.fn(),
};

vi.mock('/@/lib/worlds', async importOriginal => {
  const original = await importOriginal<typeof WorldsModule>();
  return {
    ...original,
    Worlds: class {
      getPermissions = (...args: unknown[]) => api.getPermissions(...args);
      postPermissionType = (...args: unknown[]) => api.postPermissionType(...args);
      putPermissionType = (...args: unknown[]) => api.putPermissionType(...args);
      deletePermissionType = (...args: unknown[]) => api.deletePermissionType(...args);
    },
  };
});
vi.mock('/@/lib/auth', async importOriginal => ({
  ...(await importOriginal<object>()),
  AuthServerProvider: { getAccount: () => OWNER },
}));
vi.mock('/@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('/@/lib/communities', async importOriginal => ({
  ...(await importOriginal<object>()),
  default: {
    fetchCommunity: async (_wallet: string, id: string) => ({
      id,
      name: 'Fixture Club',
      membersCount: 3,
    }),
    fetchCommunities: async () => ({
      data: { results: [{ id: CLUB, name: 'Fixture Club', membersCount: 3 }] },
    }),
  },
}));
vi.mock('/@/lib/profile', () => ({
  default: { fetchProfile: () => Promise.resolve(undefined) },
}));
vi.mock('../../../AvatarWithInfo', () => ({
  AvatarWithInfo: ({ value }: { value: string }) => <span>{value}</span>,
}));
vi.mock('decentraland-ui2', async importOriginal => ({
  ...(await importOriginal<object>()),
  AvatarFace: () => null,
}));

type Access =
  | { type: 'unrestricted' }
  | { type: 'allow-list'; wallets: string[]; communities?: string[] }
  | { type: 'shared-secret' };

async function renderSection(access: Access) {
  vi.mocked(useAuth).mockReturnValue({ wallet: OWNER } as unknown as ReturnType<typeof useAuth>);
  api.getPermissions.mockResolvedValue({
    owner: OWNER,
    permissions: {
      deployment: { type: 'allow-list', wallets: [COLLABORATOR] },
      access,
      streaming: { type: 'allow-list', wallets: [] },
    },
    summary: { [COLLABORATOR]: [{ permission: 'deployment', worldWide: true }] },
  });
  api.postPermissionType.mockResolvedValue(true);
  api.putPermissionType.mockResolvedValue(true);
  api.deletePermissionType.mockResolvedValue(true);
  render(
    <Provider store={createTestStore() as never}>
      <ThemeProvider theme={dark}>
        <AccessSection worldName="plaza.dcl.eth" />
      </ThemeProvider>
    </Provider>,
  );
  await screen.findByRole('combobox', { name: 'Access' });
}

const dropdown = () => screen.getByRole('combobox', { name: 'Access' });
const choose = (name: RegExp) => {
  fireEvent.mouseDown(dropdown());
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name }));
};
const invitedNames = () =>
  screen
    .getAllByRole('listitem')
    .map(row => row.textContent)
    .filter(Boolean);

describe('AccessSection', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
    Object.values(api).forEach(fn => fn.mockReset());
  });

  describe('when the World is public', () => {
    it('should show the type and its description, and nothing under it', async () => {
      await renderSection({ type: 'unrestricted' });

      expect(dropdown().textContent).toBe('Public  Anyone can access this world');
      expect(screen.queryByRole('tablist')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Change Password' })).toBeNull();
    });

    it('should set each type apart from its description, in the field and in every option', async () => {
      await renderSection({ type: 'unrestricted' });

      const field = dropdown();
      expect(within(field).getByText('Public')).not.toBe(field);
      expect(within(field).getByText('Anyone can access this world')).not.toBe(field);

      fireEvent.mouseDown(dropdown());
      const option = within(screen.getByRole('listbox')).getByRole('option', { name: /^Public/ });
      expect(within(option).getByText('Public')).not.toBe(option);
      expect(within(option).getByText('Anyone can access this world')).not.toBe(option);
    });

    it('should write Invitation Only at once when picked', async () => {
      await renderSection({ type: 'unrestricted' });

      choose(/^Invitation Only/);
      await act(async () => {});

      expect(api.postPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        'allow-list',
        undefined,
      );
    });
  });

  describe('when the World is invitation only', () => {
    const invited: Access = {
      type: 'allow-list',
      wallets: [OWNER, COLLABORATOR, GUEST],
      communities: [CLUB],
    };

    it('should list the invited wallets, then the communities, leaving out the owner and collaborators', async () => {
      await renderSection(invited);

      expect(screen.getByText('Invited')).toBeTruthy();
      await waitFor(() => expect(invitedNames()).toEqual(['0x0000…00c3', 'Fixture Club']));
    });

    it('should say when nobody is invited yet, with no select-all', async () => {
      await renderSection({ type: 'allow-list', wallets: [OWNER, COLLABORATOR] });

      expect(screen.getByText("You haven't invited anyone yet.")).toBeTruthy();
      expect(screen.queryByRole('checkbox', { name: 'Select all invited' })).toBeNull();
    });

    it('should switch to Public without asking when only the owner and collaborators are listed', async () => {
      await renderSection({ type: 'allow-list', wallets: [OWNER, COLLABORATOR] });

      choose(/^Public/);
      await act(async () => {});

      expect(screen.queryByRole('dialog', { name: 'Change access type?' })).toBeNull();
      expect(api.postPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        'unrestricted',
        undefined,
      );
    });

    it('should add a wallet from the address field', async () => {
      await renderSection(invited);

      fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
        target: { value: NEWCOMER },
      });
      const add = screen.getByRole('button', { name: 'Add' });
      await waitFor(() => expect(add).toHaveProperty('disabled', false), { timeout: 3000 });
      await act(async () => fireEvent.click(add));

      expect(api.putPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        NEWCOMER,
      );
    });

    it('should remove a wallet after confirming', async () => {
      await renderSection(invited);

      fireEvent.click(screen.getByRole('button', { name: 'Remove 0x0000…00c3' }));
      await act(async () =>
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' })),
      );

      expect(api.deletePermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        GUEST,
      );
    });

    it('should add a community picked from the search', async () => {
      await renderSection({ type: 'allow-list', wallets: [GUEST] });

      fireEvent.click(screen.getByRole('tab', { name: 'Add Community' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'fix' },
      });
      fireEvent.click(
        await screen.findByRole('option', { name: 'Fixture Club' }, { timeout: 3000 }),
      );
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add' })));

      expect(api.postPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        'allow-list',
        {
          wallets: [GUEST],
          communities: [CLUB],
        },
      );
    });

    it('should add every wallet of a clean CSV, by its file name', async () => {
      await renderSection({ type: 'allow-list', wallets: [GUEST] });
      fireEvent.click(screen.getByRole('tab', { name: 'Import CSV' }));

      const file = new File([`${NEWCOMER}\n`], 'invites.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(screen.getByTestId('csv-input'), { target: { files: [file] } });
      });
      await screen.findByText('invites.csv');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add' })));

      expect(api.postPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        'allow-list',
        {
          wallets: [GUEST, NEWCOMER],
          communities: [],
        },
      );
    });

    it('should hold a CSV with invalid lines, offering only REPLACE', async () => {
      await renderSection({ type: 'allow-list', wallets: [GUEST] });
      fireEvent.click(screen.getByRole('tab', { name: 'Import CSV' }));

      const file = new File([`${NEWCOMER}\nnot-an-address\n`], 'invites.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(screen.getByTestId('csv-input'), { target: { files: [file] } });
      });

      expect(await screen.findByText('1 invalid address')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });

    it('should ask before switching to Public, and write only on Continue', async () => {
      await renderSection(invited);

      choose(/^Public/);
      expect(screen.getByRole('dialog', { name: 'Change access type?' })).toBeTruthy();
      expect(api.postPermissionType).not.toHaveBeenCalled();

      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue' })));

      expect(api.postPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        'unrestricted',
        undefined,
      );
    });
  });

  describe('when Password Protected is picked', () => {
    it('should open Create New Password at once, and put the type back on cancel', async () => {
      await renderSection({ type: 'unrestricted' });

      choose(/^Password Protected/);
      expect(screen.getByRole('dialog', { name: 'Create New Password' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(dropdown().textContent).toContain('Public'));
      expect(api.postPermissionType).not.toHaveBeenCalled();
    });

    it('should write the password on CONFIRM', async () => {
      await renderSection({ type: 'unrestricted' });
      choose(/^Password Protected/);

      fireEvent.change(screen.getByLabelText('Type your password'), {
        target: { value: 'abcdefg12' },
      });
      fireEvent.change(screen.getByLabelText('Repeat your password'), {
        target: { value: 'abcdefg12' },
      });
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' })));

      expect(api.postPermissionType).toHaveBeenCalledWith(
        OWNER,
        'plaza.dcl.eth',
        'access',
        'shared-secret',
        { secret: 'abcdefg12' },
      );
    });
  });

  describe('when the World is password protected', () => {
    it('should offer CHANGE PASSWORD, opening Change Password', async () => {
      await renderSection({ type: 'shared-secret' });

      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

      expect(screen.getByRole('dialog', { name: 'Change Password' })).toBeTruthy();
    });
  });
});
