import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { resolveNameOwner } from '/@/modules/store/ens/names';
import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { RecipientField } from '.';

vi.mock('/@/modules/store/ens/names', async importOriginal => ({
  ...(await importOriginal<object>()),
  resolveNameOwner: vi.fn(),
}));
vi.mock('../../Modals/WorldPermissionsModal/WorldPermissionsAvatarWithInfo', () => ({
  WorldPermissionsAvatarWithInfo: ({ value }: { value: string }) => (
    <span>{`Profile of ${value}`}</span>
  ),
}));

const SELF = '0x1234567890123456789012345678901234567890';
const BEN = '0x00000000000000000000000000000000000000b2';

function renderField(purpose: 'transfer' | 'add' = 'transfer') {
  const onResolved = vi.fn();
  render(
    <ThemeProvider theme={dark}>
      <RecipientField
        purpose={purpose}
        self={SELF}
        onResolved={onResolved}
      />
    </ThemeProvider>,
  );
  const type = (value: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Wallet address or NAME' }), {
      target: { value },
    });
  return { onResolved, type };
}

describe('RecipientField', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when the value is neither an address nor a possible NAME', () => {
    it('should say what it expects and resolve nothing', async () => {
      const { onResolved, type } = renderField();

      type('not a name!');

      expect(await screen.findByText('Enter a wallet address or a NAME.')).toBeTruthy();
      expect(
        screen
          .getByRole('textbox', { name: 'Wallet address or NAME' })
          .getAttribute('aria-invalid'),
      ).toBe('true');
      expect(onResolved).toHaveBeenLastCalledWith(null);
    });
  });

  describe('when the NAME has no owner', () => {
    it("should say it doesn't exist", async () => {
      vi.mocked(resolveNameOwner).mockResolvedValueOnce(null);
      const { type } = renderField();

      type('nobody');

      expect(await screen.findByText("This NAME doesn't exist.")).toBeTruthy();
    });
  });

  describe("when the value is the user's own address", () => {
    it('should refuse a transfer to yourself', async () => {
      const { type } = renderField('transfer');

      type(SELF.toUpperCase().replace('0X', '0x'));

      expect(await screen.findByText("You can't transfer to yourself.")).toBeTruthy();
    });

    it('should refuse adding yourself', async () => {
      const { type } = renderField('add');

      type(SELF);

      expect(await screen.findByText("You can't add yourself.")).toBeTruthy();
    });
  });

  describe('when a NAME resolves to another wallet', () => {
    it('should resolve its owner and preview them', async () => {
      vi.mocked(resolveNameOwner).mockResolvedValueOnce(BEN);
      const { onResolved, type } = renderField();

      type('fixtureben');

      await waitFor(
        () => expect(onResolved).toHaveBeenLastCalledWith({ address: BEN, name: 'fixtureben' }),
        { timeout: 3000 },
      );
      expect(screen.getByRole('status').textContent).toBe(`Profile of ${BEN}`);
    });
  });
});
