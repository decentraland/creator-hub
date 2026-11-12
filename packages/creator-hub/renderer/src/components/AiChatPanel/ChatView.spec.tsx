import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
        assetMentions={[]}
        recording={null}
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
        onRemoveAssetMention={noop}
        onRemoveRecording={noop}
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

  describe('when the assistant is waiting for the user to answer its question', () => {
    it('should not claim the assistant is working', () => {
      renderChat({
        busy: true,
        messages: [
          userMessage,
          {
            id: 't1',
            role: 'assistant',
            parts: [
              {
                kind: 'prompt',
                prompt: {
                  id: 'q1',
                  question: 'Which door?',
                  options: [{ label: 'Wooden' }, { label: 'Metal' }],
                  multiSelect: false,
                  allowOther: false,
                },
              },
            ],
            done: false,
          },
        ],
      });
      expect(screen.queryByRole('status')).toBeNull();
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

describe('ChatView asset mentions', () => {
  beforeAll(() => {
    setCurrentLocale('en', flatten(en));
  });

  afterEach(() => {
    cleanup();
  });

  describe('when two assets are mentioned', () => {
    it('should show each asset by file name', () => {
      renderChat({
        assetMentions: [
          { path: 'assets/asset-packs/dance/Dance_emote.glb' },
          { path: 'assets/models/Throw.glb' },
        ],
      });
      expect(screen.getByText('Asset: Dance_emote.glb')).toBeTruthy();
      expect(screen.getByText('Asset: Throw.glb')).toBeTruthy();
    });

    it('should remove only the asset whose remove button is clicked', () => {
      const onRemoveAssetMention = vi.fn();
      renderChat({
        assetMentions: [
          { path: 'assets/asset-packs/dance/Dance_emote.glb' },
          { path: 'assets/models/Throw.glb' },
        ],
        onRemoveAssetMention,
      });
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
      expect(onRemoveAssetMention).toHaveBeenCalledWith({ path: 'assets/models/Throw.glb' });
    });
  });

  describe('when a built-in animation is mentioned', () => {
    it('should show it by its emote name', () => {
      renderChat({ assetMentions: [{ builtInEmote: 'wave' }] });
      expect(screen.getByText('Built-in animation: wave')).toBeTruthy();
    });
  });
  describe('when a session recording is pending', () => {
    const recording = {
      durationMs: 42_000,
      actionCount: 18,
      dir: '/tmp/recordings/s1',
      context: '[Session recording] …',
    };

    it('should show it with its duration and action count', () => {
      renderChat({ recording });
      expect(screen.getByText('Session recording · 0:42 · 18 actions')).toBeTruthy();
    });

    it('should discard it from the remove button', () => {
      const onRemoveRecording = vi.fn();
      renderChat({ recording, onRemoveRecording });
      fireEvent.click(screen.getByRole('button', { name: 'Discard recording' }));
      expect(onRemoveRecording).toHaveBeenCalled();
    });

    it('should let the user send it without typing anything', () => {
      const onSend = vi.fn();
      renderChat({ recording, onSend });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      expect(onSend).toHaveBeenCalledWith('', undefined);
    });
  });

  describe('when the panel offers the Record button', () => {
    const idle = { status: 'idle' as const, startedAt: null, micLabel: '', tools: null };

    it('should show it above the composer and pass presses on', () => {
      const onToggleRecording = vi.fn();
      renderChat({ recorder: idle, onToggleRecording });
      fireEvent.click(screen.getByRole('button', { name: 'Record' }));
      expect(screen.getByText('Record voice and actions')).toBeTruthy();
      expect(onToggleRecording).toHaveBeenCalled();
    });

    it('should turn into a timed Stop button while recording', () => {
      renderChat({
        recorder: { ...idle, status: 'recording', startedAt: Date.now() - 42_000 },
        onToggleRecording: vi.fn(),
      });
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeTruthy();
      expect(screen.getByText('Stop · 0:42')).toBeTruthy();
    });

    it('should not start a recording while no assistant is available', () => {
      renderChat({
        providers: [{ id: 'claude', label: 'Claude', available: false, managedSignIn: true }],
        recorder: idle,
        onToggleRecording: vi.fn(),
      });
      expect((screen.getByRole('button', { name: 'Record' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  describe('when the Record button is not wired (no recorder)', () => {
    it('should not show it', () => {
      renderChat({});
      expect(screen.queryByTestId('editor-record-button')).toBeNull();
    });
  });
});
