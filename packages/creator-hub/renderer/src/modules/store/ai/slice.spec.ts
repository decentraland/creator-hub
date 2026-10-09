import { beforeEach, describe, expect, it, vi } from 'vitest';

import { actions, reducer, selectionContext, send } from './slice';

const preloadAi = vi.hoisted(() => ({
  isBusy: vi.fn(),
  send: vi.fn(),
}));

vi.mock('#preload', async importOriginal => ({
  ...(await importOriginal<object>()),
  ai: preloadAi,
}));

describe('when sending while main is still running a turn', () => {
  let dispatched: unknown[];

  beforeEach(async () => {
    vi.clearAllMocks();
    preloadAi.isBusy.mockResolvedValue(true);
    dispatched = [];
    const dispatch = vi.fn((action: unknown) => {
      dispatched.push(action);
      return action;
    });
    const getState = () => ({
      editor: { project: { path: '/scene' } },
      ai: reducer(undefined, { type: 'init' }),
      workspace: {},
    });
    await send({ text: 'hello' })(dispatch, getState as never, undefined);
  });

  it('should not send the message', () => {
    expect(preloadAi.send).not.toHaveBeenCalled();
  });

  it('should mark the panel busy so the user can wait for the outcome or stop it', () => {
    expect(dispatched).toContainEqual(actions.setBusy(true));
  });

  it('should put the text back in the composer instead of dropping it', () => {
    expect(dispatched).toContainEqual(actions.setDraftPrompt('hello'));
  });

  it('should not add the message to the transcript', () => {
    expect(dispatched).not.toContainEqual(
      expect.objectContaining({ type: actions.pushUserMessage.type }),
    );
  });
});

// The "[Editor context]" line attached to a turn from the current editor selection, so the
// assistant can resolve "this" / "the selected entity" without the user spelling out ids.
describe('selectionContext', () => {
  it('is undefined when nothing is selected (so no context is attached)', () => {
    expect(selectionContext([])).toBeUndefined();
  });

  it('names a single selected entity and speaks in the singular', () => {
    const ctx = selectionContext([{ id: 512, name: 'Front Door' }]);
    expect(ctx).toContain('Front Door (id 512)');
    expect(ctx).toContain('that entity');
    expect(ctx).not.toContain('those entities');
  });

  it('lists multiple selected entities and speaks in the plural', () => {
    const ctx = selectionContext([
      { id: 512, name: 'Front Door' },
      { id: 513, name: 'Cube' },
    ]);
    expect(ctx).toContain('Front Door (id 512), Cube (id 513)');
    expect(ctx).toContain('those entities');
  });

  it('falls back to "Entity" for an unnamed selection', () => {
    expect(selectionContext([{ id: 700, name: '' }])).toContain('Entity (id 700)');
  });
});

// A rejected send must always surface its error, even when there's no in-progress assistant
// bubble to attach it to (rejected before pushUserMessage, or after — last is a user bubble).
describe('send.rejected', () => {
  it('creates an assistant error bubble when there is none in progress', () => {
    const state = reducer(undefined, {
      type: send.rejected.type,
      error: { message: 'Open a scene before using the assistant.' },
    });
    expect(state.busy).toBe(false);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      role: 'assistant',
      done: true,
      error: 'Open a scene before using the assistant.',
    });
  });

  it('attaches the error to an in-progress assistant bubble instead of adding one', () => {
    const started = reducer(undefined, {
      type: 'ai/applyEvent',
      payload: { kind: 'started', turnId: 't1' },
    });
    const state = reducer(started, { type: send.rejected.type, error: { message: 'boom' } });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ id: 't1', error: 'boom', done: true });
  });
});

// A turn's content must render in the order it streamed — text, tool chips and later text
// interleaved, never grouped by kind (#1573).
describe('applyEvent chronological parts', () => {
  const apply = (payload: unknown) => ({ type: 'ai/applyEvent', payload });

  it('keeps text → tool → later text in arrival order', () => {
    let s = reducer(undefined, apply({ kind: 'started', turnId: 't1' }));
    s = reducer(s, apply({ kind: 'text', turnId: 't1', text: 'Looking…' }));
    s = reducer(s, apply({ kind: 'tool', turnId: 't1', tool: 'Read', detail: 'src/index.ts' }));
    s = reducer(s, apply({ kind: 'text', turnId: 't1', text: 'Done.' }));
    const parts = s.messages[0].parts;
    expect(parts.map(p => p.kind)).toEqual(['text', 'tool', 'text']);
    expect(parts[0]).toMatchObject({ kind: 'text', text: 'Looking…' });
    expect(parts[2]).toMatchObject({ kind: 'text', text: 'Done.' });
  });

  it('coalesces consecutive text tokens into one part', () => {
    let s = reducer(undefined, apply({ kind: 'started', turnId: 't1' }));
    s = reducer(s, apply({ kind: 'text', turnId: 't1', text: 'Hel' }));
    s = reducer(s, apply({ kind: 'text', turnId: 't1', text: 'lo' }));
    expect(s.messages[0].parts).toEqual([{ kind: 'text', text: 'Hello' }]);
  });
});

// main gave up waiting on an `ask_user` prompt: the block must stop accepting answers.
describe('expirePrompt', () => {
  const prompt = {
    id: 'q1',
    question: 'Replace?',
    options: [],
    multiSelect: false,
    allowOther: true,
  };
  const withPrompt = () => {
    const started = reducer(undefined, {
      type: 'ai/applyEvent',
      payload: { kind: 'started', turnId: 't1' },
    });
    return reducer(started, { type: 'ai/pushPrompt', payload: prompt });
  };
  const promptOf = (state: ReturnType<typeof reducer>) =>
    state.messages.flatMap(m => m.parts).find(p => p.kind === 'prompt');

  it('marks an unanswered prompt as no longer active', () => {
    const state = reducer(withPrompt(), { type: 'ai/expirePrompt', payload: 'q1' });
    expect(promptOf(state)).toMatchObject({ prompt: { id: 'q1', dismissed: true } });
  });

  it('leaves an answered prompt as answered', () => {
    const answered = reducer(withPrompt(), {
      type: 'ai/resolvePrompt',
      payload: { id: 'q1', answer: 'Yes' },
    });
    const state = reducer(answered, { type: 'ai/expirePrompt', payload: 'q1' });
    expect(promptOf(state)).toMatchObject({ prompt: { answer: 'Yes' } });
    expect(promptOf(state)).not.toMatchObject({ prompt: { dismissed: true } });
  });
});
