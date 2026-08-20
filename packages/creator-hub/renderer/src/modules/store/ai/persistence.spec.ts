import { describe, expect, it } from 'vitest';

import { clearStoredConversation, readConversation, writeConversation } from './persistence';
import type { AiMessage } from './types';

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

describe('ai conversation persistence', () => {
  it('round-trips a transcript for a project path', () => {
    const s = fakeStorage();
    writeConversation('/scene/a', MSG, s);
    expect(readConversation('/scene/a', s)).toEqual(MSG);
  });

  it('returns an empty transcript when nothing is stored', () => {
    expect(readConversation('/scene/none', fakeStorage())).toEqual([]);
  });

  it('returns an empty transcript for corrupt stored data', () => {
    const s = fakeStorage();
    s._map.set('creator-hub:ai-conversation:/scene/a', '{not json');
    expect(readConversation('/scene/a', s)).toEqual([]);
  });

  it('keeps projects isolated by path', () => {
    const s = fakeStorage();
    writeConversation('/scene/a', MSG, s);
    expect(readConversation('/scene/b', s)).toEqual([]);
  });

  it('writing an empty transcript clears the stored entry', () => {
    const s = fakeStorage();
    writeConversation('/scene/a', MSG, s);
    writeConversation('/scene/a', [], s);
    expect(readConversation('/scene/a', s)).toEqual([]);
    expect(s._map.size).toBe(0);
  });

  it('clearStoredConversation removes the entry', () => {
    const s = fakeStorage();
    writeConversation('/scene/a', MSG, s);
    clearStoredConversation('/scene/a', s);
    expect(s._map.size).toBe(0);
  });
});
