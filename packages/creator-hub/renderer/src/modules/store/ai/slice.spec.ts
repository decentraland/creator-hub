import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiProviderInfo } from '/shared/types/ai';
import {
  actions,
  assetMentionsContext,
  fetchProviders,
  persistConversation,
  recheckAfterTurn,
  reducer,
  revertTurn,
  selectionContext,
  send,
} from './slice';

const preloadAi = vi.hoisted(() => ({
  isBusy: vi.fn(),
  send: vi.fn(),
  detectProviders: vi.fn(),
  revertTurn: vi.fn(),
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

describe('when the user sends twice before main says whether it is busy', () => {
  let ai: ReturnType<typeof reducer>;

  beforeEach(async () => {
    vi.clearAllMocks();
    preloadAi.isBusy.mockResolvedValue(false);
    preloadAi.send.mockResolvedValue({ turnId: 't-1' });
    ai = reducer(undefined, { type: 'init' });
    const dispatch = vi.fn((action: { type: string }) => {
      ai = reducer(ai, action);
      return action;
    });
    const getState = () => ({ editor: { project: { path: '/scene' } }, ai, workspace: {} });
    await Promise.all([
      send({ text: 'hello' })(dispatch as never, getState as never, undefined),
      send({ text: 'hello' })(dispatch as never, getState as never, undefined),
    ]);
  });

  it('should send the message once', () => {
    expect(preloadAi.send).toHaveBeenCalledTimes(1);
  });

  it('should add the message to the transcript once', () => {
    expect(ai.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });
});

describe('when saving a session whose first prompt was trimmed from the transcript', () => {
  let dispatched: Array<{ type: string; payload?: unknown }>;

  beforeEach(async () => {
    dispatched = [];
    const ai = {
      ...reducer(undefined, { type: 'init' }),
      currentSessionId: 's1',
      sessions: [{ id: 's1', title: 'Build a castle', updatedAt: 1 }],
      messages: [
        { id: 't-1', role: 'assistant' as const, parts: [], done: true },
        {
          id: 'u-2',
          role: 'user' as const,
          parts: [{ kind: 'text' as const, text: 'Add a moat' }],
          done: true,
        },
      ],
    };
    const dispatch = vi.fn((action: { type: string }) => {
      dispatched.push(action);
      return action;
    });
    const getState = () => ({ editor: { project: { path: '/scene' } }, ai });
    await persistConversation()(dispatch as never, getState as never, undefined);
  });

  it('should keep the title the session already has', () => {
    expect(dispatched).toContainEqual(
      actions.setSessions({
        sessions: [{ id: 's1', title: 'Build a castle', updatedAt: expect.any(Number) }],
        currentSessionId: 's1',
      }),
    );
  });
});

describe('when an asset is mentioned while the chat is hidden', () => {
  it('should ignore the mention', () => {
    const state = reducer(undefined, actions.addAssetMention({ path: 'assets/a.glb' }));
    expect(state.assetMentions).toEqual([]);
  });
});

describe('when assets are mentioned while the chat is visible', () => {
  let state: ReturnType<typeof reducer>;

  beforeEach(() => {
    state = reducer(undefined, actions.setChatVisible(true));
    state = reducer(state, actions.addAssetMention({ path: 'assets/a.glb' }));
    state = reducer(state, actions.addAssetMention({ path: 'assets/b.glb' }));
    state = reducer(state, actions.addAssetMention({ path: 'assets/a.glb' }));
  });

  it('should keep each asset once, in mention order', () => {
    expect(state.assetMentions).toEqual([{ path: 'assets/a.glb' }, { path: 'assets/b.glb' }]);
  });

  it('should drop a single asset when it is removed', () => {
    state = reducer(state, actions.removeAssetMention({ path: 'assets/a.glb' }));
    expect(state.assetMentions).toEqual([{ path: 'assets/b.glb' }]);
  });

  it('should drop every mention when the chat is hidden', () => {
    state = reducer(state, actions.setChatVisible(false));
    expect(state.assetMentions).toEqual([]);
  });
});

describe('when sending with a selected entity and mentioned assets', () => {
  let ai: ReturnType<typeof reducer>;

  beforeEach(async () => {
    vi.clearAllMocks();
    preloadAi.isBusy.mockResolvedValue(false);
    preloadAi.send.mockResolvedValue({ turnId: 't-1' });
    ai = reducer(undefined, actions.setChatVisible(true));
    ai = reducer(ai, actions.setSelection([{ id: 512, name: 'Front Door' }]));
    ai = reducer(ai, actions.addAssetMention({ path: 'assets/asset-packs/dance/Dance_emote.glb' }));
    ai = reducer(ai, actions.addAssetMention({ path: 'assets/asset-packs/throw/Throw_emote.glb' }));
    const dispatch = vi.fn((action: { type: string }) => {
      ai = reducer(ai, action);
      return action;
    });
    const getState = () => ({ editor: { project: { path: '/scene' } }, ai, workspace: {} });
    await send({ text: 'play these when the door opens' })(
      dispatch as never,
      getState as never,
      undefined,
    );
  });

  it('should attach both the selected entity and every mentioned asset as context', () => {
    const { context } = preloadAi.send.mock.calls[0][1];
    expect(context).toContain('Front Door (id 512)');
    expect(context).toContain('assets/asset-packs/dance/Dance_emote.glb');
    expect(context).toContain('assets/asset-packs/throw/Throw_emote.glb');
  });

  it('should clear the asset mentions for the next prompt', () => {
    expect(ai.assetMentions).toEqual([]);
  });

  it('should keep the selection, which is live editor state', () => {
    expect(ai.selection).toEqual([{ id: 512, name: 'Front Door' }]);
  });
});

describe('assetMentionsContext', () => {
  it('should be undefined when no asset is mentioned', () => {
    expect(assetMentionsContext([])).toBeUndefined();
  });

  describe('when a built-in animation is mentioned', () => {
    it('should tell the assistant to play it by name instead of looking for a file', () => {
      const ctx = assetMentionsContext([{ builtInEmote: 'wave' }]);
      expect(ctx).toContain('"wave"');
      expect(ctx).toContain("triggerEmote({ predefinedEmote: 'wave' })");
    });
  });

  describe('when a file and a built-in animation are mentioned together', () => {
    it('should describe both', () => {
      const ctx = assetMentionsContext([
        { path: 'assets/models/Throw_emote.glb' },
        { builtInEmote: 'robot' },
      ]);
      expect(ctx).toContain('assets/models/Throw_emote.glb');
      expect(ctx).toContain('"robot"');
    });
  });
});

describe('when the same built-in animation is mentioned twice', () => {
  it('should keep it once', () => {
    let state = reducer(undefined, actions.setChatVisible(true));
    state = reducer(state, actions.addAssetMention({ builtInEmote: 'wave' }));
    state = reducer(state, actions.addAssetMention({ builtInEmote: 'wave' }));
    expect(state.assetMentions).toEqual([{ builtInEmote: 'wave' }]);
  });
});

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

describe('when a turn ends', () => {
  const claude = (needsLogin?: boolean): AiProviderInfo => ({
    id: 'claude',
    label: 'Claude',
    available: true,
    models: [],
    defaultModel: 'default',
    managedSignIn: false,
    needsLogin,
  });

  const storeWith = async (info: AiProviderInfo) => {
    const store = configureStore({ reducer: { ai: reducer } });
    preloadAi.detectProviders.mockResolvedValueOnce([info]);
    await store.dispatch(fetchProviders());
    preloadAi.detectProviders.mockClear();
    return store;
  };

  beforeEach(() => {
    preloadAi.detectProviders.mockReset();
  });

  it('should re-detect agents after a failed turn, so a sign-in request shows up', async () => {
    const store = await storeWith(claude());
    preloadAi.detectProviders.mockResolvedValue([claude(true)]);
    await store.dispatch(recheckAfterTurn(false));
    expect(preloadAi.detectProviders).toHaveBeenCalledOnce();
    expect(store.getState().ai.providers[0].needsLogin).toBe(true);
  });

  it('should re-detect after the successful turn that follows a sign-in request', async () => {
    const store = await storeWith(claude(true));
    preloadAi.detectProviders.mockResolvedValue([claude()]);
    await store.dispatch(recheckAfterTurn(true));
    expect(preloadAi.detectProviders).toHaveBeenCalledOnce();
    expect(store.getState().ai.providers[0].needsLogin).toBeUndefined();
  });

  it('should not re-detect after an ordinary successful turn', async () => {
    const store = await storeWith(claude());
    await store.dispatch(recheckAfterTurn(true));
    expect(preloadAi.detectProviders).not.toHaveBeenCalled();
  });
});

describe('when main refuses to revert a turn', () => {
  let dispatched: { type: string; payload?: unknown }[];

  beforeEach(async () => {
    vi.clearAllMocks();
    preloadAi.revertTurn.mockResolvedValue('blocked');
    dispatched = [];
    const ai = {
      ...reducer(undefined, { type: 'init' }),
      messages: [{ id: 'a-1', role: 'assistant' as const, parts: [], done: true }],
    };
    const dispatch = vi.fn((action: { type: string; payload?: unknown }) => {
      dispatched.push(action);
      return action;
    });
    await revertTurn({ id: 'a-1', count: 2 })(
      dispatch as never,
      (() => ({ ai })) as never,
      undefined,
    );
  });

  it('should mark the turn as not reverted again, so the button stays honest', () => {
    expect(dispatched).toContainEqual(actions.unmarkReverted('a-1'));
  });

  it('should report the turn as blocked so the snackbar can say why', () => {
    expect(dispatched).toContainEqual(
      expect.objectContaining({ type: revertTurn.rejected.type, payload: 'blocked' }),
    );
  });
});

describe('when reverting a turn fails for another reason', () => {
  let dispatched: { type: string; payload?: unknown }[];

  beforeEach(async () => {
    vi.clearAllMocks();
    preloadAi.revertTurn.mockRejectedValue(new Error('editor went away'));
    dispatched = [];
    const ai = {
      ...reducer(undefined, { type: 'init' }),
      messages: [{ id: 'a-1', role: 'assistant' as const, parts: [], done: true }],
    };
    const dispatch = vi.fn((action: { type: string; payload?: unknown }) => {
      dispatched.push(action);
      return action;
    });
    await revertTurn({ id: 'a-1', count: 2 })(
      dispatch as never,
      (() => ({ ai })) as never,
      undefined,
    );
  });

  it('should keep the turn marked, so a retry can’t undo the user’s own edits', () => {
    expect(dispatched).not.toContainEqual(actions.unmarkReverted('a-1'));
  });

  it('should report the turn as failed without the blocked reason', () => {
    const rejected = dispatched.find(a => a.type === revertTurn.rejected.type);
    expect(rejected).toBeDefined();
    expect(rejected?.payload).toBeUndefined();
  });
});
