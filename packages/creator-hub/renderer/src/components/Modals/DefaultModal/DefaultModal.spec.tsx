import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { DefaultModal } from '.';

type ModalProps = Parameters<typeof DefaultModal>[0];

function renderModal(props: Partial<ModalProps> = {}) {
  const handlers = { onClose: vi.fn(), onCancel: vi.fn(), onConfirm: vi.fn() };
  render(
    <ThemeProvider theme={dark}>
      <DefaultModal
        open
        title="Unpublish Scene"
        body="Are you sure?"
        onClose={handlers.onClose}
        secondary={{ label: 'Cancel', onClick: handlers.onCancel }}
        primary={{ label: 'Unpublish', onClick: handlers.onConfirm, state: 'idle' }}
        {...props}
      />
    </ThemeProvider>,
  );
  return handlers;
}

describe('DefaultModal', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when open', () => {
    it('should be a dialog named by its title and described by its body', () => {
      renderModal();

      const dialog = screen.getByRole('dialog', { name: 'Unpublish Scene' });
      expect(dialog.getAttribute('aria-describedby')).toBe(
        screen.getByText('Are you sure?').getAttribute('id'),
      );
    });

    it('should put focus on Cancel, the safe action', () => {
      renderModal();

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });

    it('should close from the Close button and from Escape', () => {
      const { onClose } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('should run each action from its button', () => {
      const { onCancel, onConfirm } = renderModal();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));

      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('when the primary action is blocked', () => {
    it('should disable only the primary button', () => {
      renderModal({ primary: { label: 'Unpublish', onClick: vi.fn(), state: 'blocked' } });

      expect(screen.getByRole('button', { name: 'Unpublish' })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', false);
    });
  });

  describe('when the primary action is busy', () => {
    it('should disable both actions and show progress', () => {
      renderModal({ primary: { label: 'Unpublish', onClick: vi.fn(), state: 'busy' } });

      const [cancel, confirm] = screen
        .getAllByRole('button')
        .filter(button => button.getAttribute('aria-label') !== 'Close');
      expect(cancel).toHaveProperty('disabled', true);
      expect(confirm).toHaveProperty('disabled', true);
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
  });
});
