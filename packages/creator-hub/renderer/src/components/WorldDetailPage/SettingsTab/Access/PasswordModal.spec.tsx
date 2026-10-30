import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { PasswordModal } from './PasswordModal';

function renderModal(mode: 'create' | 'change' = 'create') {
  const handlers = { onCancel: vi.fn(), onConfirm: vi.fn() };
  render(
    <ThemeProvider theme={dark}>
      <PasswordModal
        open
        mode={mode}
        {...handlers}
      />
    </ThemeProvider>,
  );
  return handlers;
}

const typed = () => screen.getByLabelText('Type your password');
const repeated = () => screen.getByLabelText('Repeat your password');
const confirm = () => screen.getByRole('button', { name: 'Confirm' });
const write = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

describe('PasswordModal', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when the World has no password yet', () => {
    it('should ask to create one, with both fields hidden and CONFIRM blocked', () => {
      renderModal();

      expect(screen.getByRole('dialog', { name: 'Create New Password' })).toBeTruthy();
      expect(typed().getAttribute('type')).toBe('password');
      expect(repeated().getAttribute('type')).toBe('password');
      expect(confirm()).toHaveProperty('disabled', true);
      expect(document.activeElement).toBe(typed());
    });
  });

  describe('when the password is changed', () => {
    it('should be titled Change Password', () => {
      renderModal('change');

      expect(screen.getByRole('dialog', { name: 'Change Password' })).toBeTruthy();
    });
  });

  describe('when neither field has an error', () => {
    it('should keep no error row under either field', () => {
      renderModal();
      write(typed(), 'abcdefg12');

      expect(screen.queryAllByRole('alert')).toHaveLength(0);
      expect(typed().hasAttribute('aria-describedby')).toBe(false);
      expect(repeated().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('when the typed password misses the rules', () => {
    it('should describe the field by its error alert', () => {
      renderModal();
      write(typed(), 'abc');

      const alert = screen.getByRole('alert');
      expect(typed().getAttribute('aria-describedby')).toBe(alert.id);
      expect(alert.textContent).toContain('At least 8 characters');
    });

    it('should list each unmet rule under the field', () => {
      renderModal();
      write(typed(), 'abc');

      const errors = screen.getByText('Your password must have').parentElement!.textContent;
      expect(errors).toContain('At least 8 characters');
      expect(errors).toContain('At least 2 numbers');

      write(typed(), 'abcdefgh1');
      expect(screen.getByText('Your password must have').parentElement!.textContent).not.toContain(
        'At least 8 characters',
      );
    });
  });

  describe('when the repeat does not match', () => {
    it("should say the passwords don't match and keep CONFIRM blocked", () => {
      renderModal();
      write(typed(), 'abcdefg12');
      write(repeated(), 'abcdefg13');

      expect(screen.getByText("Passwords don't match")).toBeTruthy();
      expect(confirm()).toHaveProperty('disabled', true);
    });
  });

  describe('when both fields are valid and match', () => {
    it('should confirm with the password', () => {
      const { onConfirm } = renderModal();
      write(typed(), 'abcdefg12');
      write(repeated(), 'abcdefg12');

      fireEvent.click(confirm());

      expect(onConfirm).toHaveBeenCalledWith('abcdefg12');
    });
  });

  describe('when the eye toggle is pressed', () => {
    it('should show the password and offer to hide it again', () => {
      renderModal();

      fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);

      expect(typed().getAttribute('type')).toBe('text');
      expect(screen.getAllByRole('button', { name: 'Hide password' })).toHaveLength(1);
    });
  });

  describe('when it is cancelled', () => {
    it('should cancel without confirming', () => {
      const { onCancel, onConfirm } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
