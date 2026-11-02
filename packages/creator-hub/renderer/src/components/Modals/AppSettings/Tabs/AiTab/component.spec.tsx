import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { ai, misc } from '#preload';

import type { AiProviderInfo } from '/shared/types/ai';
import type { AppSettings } from '/shared/types/settings';

import AiTab from './component';

vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string) => id,
}));

const claude: AiProviderInfo = {
  id: 'claude',
  label: 'Claude',
  available: true,
  models: [],
  defaultModel: 'default',
  managedSignIn: false,
};

function renderWith(info: AiProviderInfo) {
  vi.spyOn(ai, 'detectProviders').mockResolvedValue([info]);
  render(
    <ThemeProvider theme={dark}>
      <AiTab
        settings={{ aiAssistant: true } as AppSettings}
        updateSettings={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe('AI settings agent card', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the agent asked the user to sign in', () => {
    beforeEach(() => {
      renderWith({ ...claude, needsLogin: true });
    });

    it('should say sign-in is needed instead of connected', async () => {
      expect(await screen.findByText('editor.ai.setup.needs_login_status')).toBeTruthy();
      expect(screen.queryByText('modal.app_settings.fields.ai_connect.connected')).toBeNull();
    });

    it('should show the sign-out and sign-in steps and the install guide without expanding anything', async () => {
      expect(await screen.findByText('claude auth logout')).toBeTruthy();
      expect(screen.getByText('claude auth login')).toBeTruthy();
      expect(screen.getByText('editor.ai.setup.install_guide')).toBeTruthy();
      expect(screen.getByText('editor.ai.setup.api_key_alternative')).toBeTruthy();
    });

    it('should not offer an in-app sign out that leaves the terminal sign-in untouched', async () => {
      await screen.findByText('claude auth logout');
      expect(screen.queryByText('modal.app_settings.fields.ai_connect.sign_out')).toBeNull();
    });

    it('should copy a command through the app instead of the browser clipboard', async () => {
      const copy = vi.spyOn(misc, 'copyToClipboard').mockResolvedValue();
      const field = (await screen.findByText('claude auth logout')).parentElement as HTMLElement;
      fireEvent.click(
        within(field).getByRole('button', { name: 'modal.app_settings.fields.ai_connect.copy' }),
      );
      expect(copy).toHaveBeenCalledWith('claude auth logout');
    });
  });

  describe('when an agent the app signed in to asks to sign in again', () => {
    beforeEach(() => {
      renderWith({ ...claude, id: 'codex', label: 'Codex', managedSignIn: true, needsLogin: true });
    });

    it('should point at Sign out and Sign in instead of terminal commands', async () => {
      expect(await screen.findByText('editor.ai.setup.needs_login_managed_help')).toBeTruthy();
      expect(screen.queryByText('editor.ai.setup.needs_login_help')).toBeNull();
      expect(screen.queryByText('codex logout')).toBeNull();
      expect(screen.getByText('modal.app_settings.fields.ai_connect.sign_out')).toBeTruthy();
    });
  });

  describe('when Claude is missing but Claude Desktop is installed', () => {
    beforeEach(() => {
      renderWith({ ...claude, available: false, desktopInstalled: true });
    });

    it('should show the Desktop note with the install steps already open', async () => {
      expect(await screen.findByText('editor.ai.setup.desktop_detected')).toBeTruthy();
      expect(screen.getByText('curl -fsSL https://claude.ai/install.sh | bash')).toBeTruthy();
    });
  });

  describe('when the agent is signed in', () => {
    beforeEach(() => {
      renderWith(claude);
    });

    it('should say connected and keep the terminal steps collapsed', async () => {
      expect(
        await screen.findByText('modal.app_settings.fields.ai_connect.connected'),
      ).toBeTruthy();
      expect(screen.queryByText('editor.ai.setup.needs_login_status')).toBeNull();
      expect(screen.queryByText('claude')).toBeNull();
    });
  });

  describe('when the user signs out of an agent the app signed in to', () => {
    beforeEach(() => {
      vi.spyOn(ai, 'signOutCli').mockReturnValue(new Promise(() => {}));
      renderWith({ ...claude, id: 'codex', label: 'Codex', managedSignIn: true });
    });

    it('should show a spinner in the disabled button until the agent is re-checked', async () => {
      const button = await screen.findByRole('button', {
        name: 'modal.app_settings.fields.ai_connect.sign_out',
      });
      expect(screen.queryByRole('progressbar')).toBeNull();
      fireEvent.click(button);
      expect(await screen.findByRole('progressbar')).toBeTruthy();
      expect(button.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('when the user signs in to an agent from the app', () => {
    beforeEach(() => {
      vi.spyOn(ai, 'signInCli').mockReturnValue(new Promise(() => {}));
      renderWith({ ...claude, id: 'codex', label: 'Codex', available: false, managedSignIn: true });
    });

    it('should show a spinner in the button while the sign-in runs', async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'modal.app_settings.fields.ai_connect.sign_in' }),
      );
      const cancel = await screen.findByRole('button', {
        name: 'modal.app_settings.fields.ai_connect.cancel',
      });
      expect(cancel.querySelector('[role="progressbar"]')).toBeTruthy();
    });
  });
});
