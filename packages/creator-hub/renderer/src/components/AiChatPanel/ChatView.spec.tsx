import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

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
    provider: 'claude',
    messages: [],
    busy: false,
    detecting: false,
    selection: [],
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
    onClose: vi.fn(),
  };
  render(
    <ThemeProvider theme={dark}>
      <ChatView {...props} />
    </ThemeProvider>,
  );
}

describe('AI chat panel', () => {
  afterEach(cleanup);

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

  describe('when the agent is signed in', () => {
    it('should not show the sign-in hint', () => {
      renderWith({});
      expect(screen.queryByText('editor.ai.setup.needs_login_title')).toBeNull();
    });
  });
});
