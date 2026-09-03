import { describe, expect, it } from 'vitest';

import {
  MAX_SESSIONS,
  deleteSessionStorage,
  readBillingDismissed,
  readSessionIndex,
  readSessionMessages,
  writeBillingDismissed,
  writeSessionIndex,
  writeSessionMessages,
} from './persistence';
import type { AiMessage, AiSessionMeta } from './types';

// A minimal in-memory Storage stand-in so the tests don't touch a real localStorage.
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

const MSG: AiMessage[] = [
  { id: 'u1', role: 'user', text: 'hi', tools: [], done: true },
  { id: 't1', role: 'assistant', text: 'hello', tools: [], done: true },
];

describe('ai session transcripts', () => {
  it('round-trips a transcript for a (path, session id)', () => {
    const s = fakeStorage();
    writeSessionMessages('/scene/a', 's1', MSG, s);
    expect(readSessionMessages('/scene/a', 's1', s)).toEqual(MSG);
  });

  it('keeps sessions isolated by id and by path', () => {
    const s = fakeStorage();
    writeSessionMessages('/scene/a', 's1', MSG, s);
    expect(readSessionMessages('/scene/a', 's2', s)).toEqual([]);
    expect(readSessionMessages('/scene/b', 's1', s)).toEqual([]);
  });

  it('returns an empty transcript for corrupt stored data', () => {
    const s = fakeStorage();
    s._map.set('creator-hub:ai-session:/scene/a:s1', '{not json');
    expect(readSessionMessages('/scene/a', 's1', s)).toEqual([]);
  });

  it('writing an empty transcript clears the stored entry', () => {
    const s = fakeStorage();
    writeSessionMessages('/scene/a', 's1', MSG, s);
    writeSessionMessages('/scene/a', 's1', [], s);
    expect(readSessionMessages('/scene/a', 's1', s)).toEqual([]);
    expect(s._map.size).toBe(0);
  });

  it('strips inline screenshot images before persisting', () => {
    const s = fakeStorage();
    const withImage: AiMessage[] = [
      {
        id: 't1',
        role: 'assistant',
        text: 'see',
        tools: [],
        done: true,
        images: ['data:image/png;base64,AAAA'],
      },
    ];
    writeSessionMessages('/scene/a', 's1', withImage, s);
    expect(readSessionMessages('/scene/a', 's1', s)[0].images).toBeUndefined();
  });

  it('deleteSessionStorage removes only that session', () => {
    const s = fakeStorage();
    writeSessionMessages('/scene/a', 's1', MSG, s);
    writeSessionMessages('/scene/a', 's2', MSG, s);
    deleteSessionStorage('/scene/a', 's1', s);
    expect(readSessionMessages('/scene/a', 's1', s)).toEqual([]);
    expect(readSessionMessages('/scene/a', 's2', s)).toEqual(MSG);
  });
});

describe('ai session index', () => {
  const meta = (id: string, updatedAt: number): AiSessionMeta => ({ id, title: id, updatedAt });

  it('is empty when nothing is stored', () => {
    expect(readSessionIndex('/scene/none', fakeStorage())).toEqual({ current: '', sessions: [] });
  });

  it('round-trips the current id and the session list', () => {
    const s = fakeStorage();
    const index = { current: 's1', sessions: [meta('s1', 2), meta('s2', 1)] };
    writeSessionIndex('/scene/a', index, s);
    expect(readSessionIndex('/scene/a', s)).toEqual(index);
  });

  it('caps the stored list at MAX_SESSIONS (oldest fall off)', () => {
    const s = fakeStorage();
    const sessions = Array.from({ length: MAX_SESSIONS + 5 }, (_, i) => meta(`s${i}`, i));
    writeSessionIndex('/scene/a', { current: 's0', sessions }, s);
    expect(readSessionIndex('/scene/a', s).sessions).toHaveLength(MAX_SESSIONS);
  });

  it('drops malformed session metas', () => {
    const s = fakeStorage();
    s._map.set(
      'creator-hub:ai-index:/scene/a',
      JSON.stringify({ current: 's1', sessions: [meta('s1', 1), { id: 'x' }, null, 42] }),
    );
    expect(readSessionIndex('/scene/a', s).sessions).toEqual([meta('s1', 1)]);
  });
});

describe('ai billing-hint dismissal', () => {
  it('round-trips per project path', () => {
    const s = fakeStorage();
    expect(readBillingDismissed('/scene/a', s)).toBe(false);
    writeBillingDismissed('/scene/a', true, s);
    expect(readBillingDismissed('/scene/a', s)).toBe(true);
    writeBillingDismissed('/scene/a', false, s);
    expect(readBillingDismissed('/scene/a', s)).toBe(false);
  });
});
