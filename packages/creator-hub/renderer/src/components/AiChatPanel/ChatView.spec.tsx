import { cleanup, render, screen } from '@testing-library/react';
import { flatten } from 'flat';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';
import type { AiMessage } from '/@/modules/store/ai/types';

import { ChatView, type ChatViewProps } from './ChatView';

vi.mock('#preload', () => ({
  ai: {
    getPathForFile: vi.fn(),
    getMcpServerInfo: vi.fn(async () => ({ url: '', token: '' })),
  },
}));

const userMessage: AiMessage = {
  id: 'u-1',
  role: 'user',
  parts: [{ kind: 'text', text: 'add a door' }],
  done: true,
};

function renderChat(props: Partial<ChatViewProps>) {
  const noop = () => {};
  return render(
    <ThemeProvider theme={dark}>
      <ChatView
        providers={[{ id: 'claude', label: 'Claude', available: true, managedSignIn: true }]}
        provider="claude"
        messages={[]}
        busy={false}
        detecting={false}
        selection={[]}
        billingDismissed
        sessions={[]}
        currentSessionId="s1"
        onSend={noop}
        onStop={noop}
        onNewChat={noop}
        onProviderChange={noop}
        onRevertTurn={noop}
        onAnswerPrompt={noop}
        onRecheck={noop}
        onDismissBilling={noop}
        onSwitchSession={noop}
        onDeleteSession={noop}
        onClearSelection={noop}
        onClose={noop}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe('ChatView working indicator', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(cleanup);

  describe('when a message was sent and the assistant has not started replying yet', () => {
    it('should show that the assistant is working', () => {
      renderChat({ busy: true, messages: [userMessage] });
      expect(screen.getByRole('status').textContent).toContain(en.editor.ai.thinking);
    });
  });

  describe('when the assistant has replied partway and is still working', () => {
    it('should keep showing that the assistant is working', () => {
      renderChat({
        busy: true,
        messages: [
          userMessage,
          {
            id: 't1',
            role: 'assistant',
            parts: [
              { kind: 'text', text: 'Placing the door now.' },
              { kind: 'tool', tool: 'place_smart_item', detail: '' },
            ],
            done: false,
          },
        ],
      });
      expect(screen.getByRole('status').textContent).toContain(en.editor.ai.thinking);
    });
  });

  describe('when the turn has finished', () => {
    it('should not show the working indicator', () => {
      renderChat({
        busy: false,
        messages: [
          userMessage,
          { id: 't1', role: 'assistant', parts: [{ kind: 'text', text: 'Done.' }], done: true },
        ],
      });
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
