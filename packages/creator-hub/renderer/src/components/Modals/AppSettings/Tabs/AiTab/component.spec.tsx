import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { ai } from '#preload';

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

    it('should show the sign-in command and the install guide without expanding anything', async () => {
      expect(await screen.findByText('claude')).toBeTruthy();
      expect(screen.getByText('editor.ai.setup.install_guide')).toBeTruthy();
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
});
