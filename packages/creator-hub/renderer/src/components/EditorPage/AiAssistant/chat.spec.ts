import { describe, expect, it } from 'vitest';

import { chatReducer, extractApiErrorMessage, getToolLabel, INITIAL_CHAT_STATE } from './chat';

import type { ChatState } from './chat';

const PROJECT_PATH = '/home/user/scene';

function applyEvents(state: ChatState, events: Record<string, unknown>[]): ChatState {
  return events.reduce(
    (current, event) =>
      chatReducer(current, {
        type: 'event',
        event: event as Record<string, unknown> & { type: string },
        projectPath: PROJECT_PATH,
      }),
    state,
  );
}

describe('chatReducer', () => {
  describe('when the user sends a prompt', () => {
    it('should append a user message and mark the chat as busy', () => {
      const state = chatReducer(INITIAL_CHAT_STATE, { type: 'prompt', text: 'add a fountain' });
      expect(state.items).toEqual([{ kind: 'user', text: 'add a fountain' }]);
      expect(state.busy).toBe(true);
    });
  });

  describe('when text deltas stream in after a text_start', () => {
    it('should accumulate them into a single assistant message', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'agent_start' },
        { type: 'message_update', assistantMessageEvent: { type: 'text_start' } },
        { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'Hello ' } },
        { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'world' } },
      ]);
      expect(state.busy).toBe(true);
      expect(state.items).toEqual([{ kind: 'assistant', text: 'Hello world' }]);
    });
  });

  describe('when a text delta arrives without a preceding text_start', () => {
    it('should create a new assistant message', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'hi' } },
      ]);
      expect(state.items).toEqual([{ kind: 'assistant', text: 'hi' }]);
    });
  });

  describe('when thinking deltas stream in', () => {
    it('should ignore them', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        {
          type: 'message_update',
          assistantMessageEvent: { type: 'thinking_delta', delta: 'hmm' },
        },
      ]);
      expect(state.items).toEqual([]);
    });
  });

  describe('when a tool executes', () => {
    it('should append a running tool line and mark it done on completion', () => {
      const started = applyEvents(INITIAL_CHAT_STATE, [
        {
          type: 'tool_execution_start',
          toolCallId: 'call_1',
          toolName: 'edit',
          args: { path: `${PROJECT_PATH}/src/index.ts` },
        },
      ]);
      expect(started.items).toEqual([
        { kind: 'tool', id: 'call_1', label: 'edit src/index.ts', status: 'running' },
      ]);

      const ended = applyEvents(started, [
        { type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'edit', isError: false },
      ]);
      expect(ended.items).toEqual([
        { kind: 'tool', id: 'call_1', label: 'edit src/index.ts', status: 'done' },
      ]);
    });

    it('should mark the tool line as error when the tool fails', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'tool_execution_start', toolCallId: 'call_1', toolName: 'bash', args: {} },
        { type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'bash', isError: true },
      ]);
      expect(state.items).toEqual([{ kind: 'tool', id: 'call_1', label: 'bash', status: 'error' }]);
    });
  });

  describe('when the agent run ends', () => {
    it('should clear the busy flag', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'agent_start' },
        { type: 'agent_end' },
      ]);
      expect(state.busy).toBe(false);
    });
  });

  describe('when a command response fails', () => {
    it('should append an error and clear the busy flag', () => {
      const busyState = chatReducer(INITIAL_CHAT_STATE, { type: 'prompt', text: 'do it' });
      const state = applyEvents(busyState, [
        { type: 'response', command: 'prompt', success: false, error: 'agent is streaming' },
      ]);
      expect(state.busy).toBe(false);
      expect(state.items[state.items.length - 1]).toEqual({
        kind: 'error',
        text: 'agent is streaming',
      });
    });
  });

  describe('when a successful command response arrives', () => {
    it('should leave the state untouched', () => {
      const busyState = chatReducer(INITIAL_CHAT_STATE, { type: 'prompt', text: 'do it' });
      const state = applyEvents(busyState, [
        { type: 'response', command: 'prompt', success: true },
      ]);
      expect(state).toEqual(busyState);
    });
  });

  describe('when the agent process exits', () => {
    it('should append an exit item and mark the chat as exited', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [{ type: 'agent_exit', code: 1 }]);
      expect(state.exited).toBe(true);
      expect(state.busy).toBe(false);
      expect(state.items).toEqual([{ kind: 'exit', code: 1 }]);
    });
  });

  describe('when an assistant message ends with a provider error', () => {
    it('should surface the error message and clear the busy flag', () => {
      const busyState = applyEvents(
        chatReducer(INITIAL_CHAT_STATE, { type: 'prompt', text: 'do it' }),
        [{ type: 'agent_start' }],
      );
      const state = applyEvents(busyState, [
        {
          type: 'message_end',
          message: {
            role: 'assistant',
            content: [],
            stopReason: 'error',
            errorMessage:
              '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
          },
        },
      ]);
      expect(state.busy).toBe(false);
      expect(state.items[state.items.length - 1]).toEqual({
        kind: 'error',
        text: 'Your credit balance is too low to access the Anthropic API.',
      });
    });
  });

  describe('when an assistant message ends without an error', () => {
    it('should leave the items untouched', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        {
          type: 'message_end',
          message: { role: 'assistant', content: [], stopReason: 'stop' },
        },
      ]);
      expect(state.items).toEqual([]);
    });
  });

  describe('when a file-modifying tool completes successfully', () => {
    it('should flag that files changed', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'tool_execution_start', toolCallId: 'call_1', toolName: 'edit', args: {} },
        { type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'edit', isError: false },
      ]);
      expect(state.filesChanged).toBe(true);
    });
  });

  describe('when a read-only tool completes successfully', () => {
    it('should not flag that files changed', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'tool_execution_start', toolCallId: 'call_1', toolName: 'read', args: {} },
        { type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'read', isError: false },
      ]);
      expect(state.filesChanged).toBe(false);
    });
  });

  describe('when a file-modifying tool fails', () => {
    it('should not flag that files changed', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'tool_execution_start', toolCallId: 'call_1', toolName: 'write', args: {} },
        { type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'write', isError: true },
      ]);
      expect(state.filesChanged).toBe(false);
    });
  });

  describe('when the scene reload is acknowledged', () => {
    it('should clear the flag and append a scene reloaded item', () => {
      const changed = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'tool_execution_start', toolCallId: 'call_1', toolName: 'edit', args: {} },
        { type: 'tool_execution_end', toolCallId: 'call_1', toolName: 'edit', isError: false },
      ]);
      const state = chatReducer(changed, { type: 'scene_reloaded' });
      expect(state.filesChanged).toBe(false);
      expect(state.items[state.items.length - 1]).toEqual({ kind: 'scene_reloaded' });
    });
  });

  describe('when a notify extension UI request arrives', () => {
    it('should append a status line with the message', () => {
      const state = applyEvents(INITIAL_CHAT_STATE, [
        { type: 'extension_ui_request', method: 'notify', message: 'Command blocked' },
      ]);
      expect(state.items).toEqual([{ kind: 'status', text: 'Command blocked' }]);
    });
  });
});

describe('getToolLabel', () => {
  describe('when the args contain a path inside the project', () => {
    it('should render the path relative to the project', () => {
      expect(getToolLabel('read', { path: `${PROJECT_PATH}/src/index.ts` }, PROJECT_PATH)).toBe(
        'read src/index.ts',
      );
    });
  });

  describe('when the args contain a command', () => {
    it('should render the command', () => {
      expect(getToolLabel('bash', { command: 'npm run build' }, PROJECT_PATH)).toBe(
        'bash npm run build',
      );
    });
  });

  describe('when the args contain nothing path-like', () => {
    it('should render the tool name alone', () => {
      expect(getToolLabel('list', {}, PROJECT_PATH)).toBe('list');
      expect(getToolLabel('list', undefined, PROJECT_PATH)).toBe('list');
    });
  });
});

describe('extractApiErrorMessage', () => {
  describe('when the raw string embeds an API error JSON payload', () => {
    it('should return the inner message', () => {
      expect(
        extractApiErrorMessage(
          '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
        ),
      ).toBe('Overloaded');
    });
  });

  describe('when the raw string is not JSON', () => {
    it('should return the raw string', () => {
      expect(extractApiErrorMessage('socket hang up')).toBe('socket hang up');
    });
  });
});
