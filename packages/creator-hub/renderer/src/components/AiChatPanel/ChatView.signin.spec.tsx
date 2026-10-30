import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';
import { ai } from '#preload';

import { ChatView, type ChatViewProps } from './ChatView';

vi.mock('/@/modules/store/translation/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  t: (id: string) => id,
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

function renderWith(provider: Partial<ChatViewProps['providers'][number]>) {
  const props: ChatViewProps = {
    providers: [
      { id: 'claude', label: 'Claude', available: true, managedSignIn: false, ...provider },
    ],
    provider: provider.id ?? 'claude',
    messages: [],
    busy: false,
    detecting: false,
    selection: [],
    assetMentions: [],
    billingDismissed: true,
    sessions: [],
    currentSessionId: '',
    onSend: vi.fn(),
    onStop: vi.fn(),
    onNewChat: vi.fn(),
    onProviderChange: vi.fn(),
    onRevertTurn: vi.fn(),
    onAnswerPrompt: vi.fn(),
    onRecheck: vi.fn(),
    onDismissBilling: vi.fn(),
    onSwitchSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onClearSelection: vi.fn(),
    onRemoveAssetMention: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <ThemeProvider theme={dark}>
      <ChatView {...props} />
    </ThemeProvider>,
  );
}

describe('AI chat panel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('when the agent asked the user to sign in', () => {
    it('should keep the composer enabled and show the sign-out and sign-in steps with the install guide', () => {
      renderWith({ needsLogin: true });
      expect(screen.getByText('editor.ai.setup.needs_login_title')).toBeTruthy();
      expect(screen.getAllByText(/^claude auth/).map(e => e.textContent)).toEqual([
        'claude auth logout',
        'claude auth login',
      ]);
      expect(screen.getByText('editor.ai.setup.install_guide')).toBeTruthy();
      expect(screen.getByText('editor.ai.setup.api_key_alternative')).toBeTruthy();
      expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(false);
    });
  });

  describe('when an agent the app signed in to asks to sign in again', () => {
    it('should point at Settings instead of terminal commands', () => {
      renderWith({ id: 'codex', label: 'Codex', managedSignIn: true, needsLogin: true });
      expect(screen.getByText('editor.ai.setup.needs_login_managed_help')).toBeTruthy();
      expect(screen.queryByText('editor.ai.setup.needs_login_help')).toBeNull();
      expect(screen.queryByText('codex logout')).toBeNull();
    });
  });

  describe('when Claude Code is missing and Claude Desktop is installed', () => {
    it('should show the Desktop note and the terminal steps instead of an in-app sign-in', () => {
      vi.spyOn(ai, 'getMcpServerInfo').mockRejectedValue(new Error('no MCP in tests'));
      renderWith({ available: false, desktopInstalled: true });
      expect(screen.getByText('editor.ai.setup.desktop_detected')).toBeTruthy();
      expect(screen.getByText('curl -fsSL https://claude.ai/install.sh | bash')).toBeTruthy();
      expect(screen.getByText('claude auth login')).toBeTruthy();
      expect(screen.getByText('editor.ai.setup.install_guide')).toBeTruthy();
      expect(screen.queryByText('editor.ai.setup.signin_button')).toBeNull();
    });
  });

  describe('when the agent is signed in', () => {
    it('should not show the sign-in hint', () => {
      renderWith({});
      expect(screen.queryByText('editor.ai.setup.needs_login_title')).toBeNull();
    });
  });
});
