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
