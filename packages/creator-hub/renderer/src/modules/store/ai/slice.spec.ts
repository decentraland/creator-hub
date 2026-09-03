import { describe, expect, it } from 'vitest';

import { reducer, selectionContext, send } from './slice';

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
