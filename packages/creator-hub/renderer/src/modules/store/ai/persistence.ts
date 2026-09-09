/**
 * Per-project persistence of the AI chat, so conversations survive an app restart. Kept in
 * localStorage (the renderer origin is stable across restarts). Each scene keeps MULTIPLE
 * sessions (a browsable history), stored as:
 *
 *   - an index per scene: `${INDEX_PREFIX}<path>` → { current, sessions: AiSessionMeta[] }
 *   - one transcript per session: `${SESSION_PREFIX}<path>:<sessionId>` → { messages }
 *
 * so switching sessions only loads the one transcript. The provider resume ids that make
 * `--resume` continue are persisted separately by the main process (ai.ts), keyed by the
 * same (project path, sessionId) — the two are coordinated only by those.
 */
import type { AiMessage, AiPart, AiSessionMeta } from './types';

const INDEX_PREFIX = 'creator-hub:ai-index:';
const SESSION_PREFIX = 'creator-hub:ai-session:';
// Per-project dismissal of the "uses your own account" billing hint (#1505). Kept apart
// from the transcripts so clearing a chat doesn't bring the hint back.
const BILLING_DISMISSED_PREFIX = 'creator-hub:ai-billing-dismissed:';
// localStorage is ~5MB per origin; keep one transcript well under that. A transcript larger
// than this just isn't persisted (the live one still works) rather than throwing.
const MAX_BYTES = 1_000_000;
// Cap the history per scene so it can't grow without bound; oldest sessions fall off.
export const MAX_SESSIONS = 20;

export interface SessionIndex {
  current: string;
  sessions: AiSessionMeta[]; // newest first
}

function indexKey(path: string): string {
  return `${INDEX_PREFIX}${path}`;
}
function sessionKey(path: string, id: string): string {
  return `${SESSION_PREFIX}${path}:${id}`;
}

function isMeta(x: unknown): x is AiSessionMeta {
  return (
    x !== null &&
    typeof x === 'object' &&
    typeof (x as AiSessionMeta).id === 'string' &&
    typeof (x as AiSessionMeta).title === 'string' &&
    typeof (x as AiSessionMeta).updatedAt === 'number'
  );
}

export function readSessionIndex(
  path: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): SessionIndex {
  try {
    const raw = storage.getItem(indexKey(path));
    if (raw === null) return { current: '', sessions: [] };
    const parsed = JSON.parse(raw) as Partial<SessionIndex>;
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions.filter(isMeta) : [];
    return { current: typeof parsed.current === 'string' ? parsed.current : '', sessions };
  } catch {
    return { current: '', sessions: [] }; // unavailable or corrupt — start empty
  }
}

export function writeSessionIndex(
  path: string,
  index: SessionIndex,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    const sessions = index.sessions.slice(0, MAX_SESSIONS);
    storage.setItem(indexKey(path), JSON.stringify({ current: index.current, sessions }));
  } catch {
    /* quota exceeded or storage unavailable — non-fatal */
  }
}

// A transcript persisted before the parts model (#1573) stores `text`/`tools` on each message
// and no `parts`. Migrate those to ordered parts on read so old conversations still render (the
// grouped text-then-tools order is the best we can reconstruct; true arrival order wasn't stored).
interface LegacyMessage {
  text?: unknown;
  tools?: unknown;
}
function legacyParts(m: LegacyMessage): AiPart[] {
  const parts: AiPart[] = [];
  if (typeof m.text === 'string' && m.text !== '') parts.push({ kind: 'text', text: m.text });
  if (Array.isArray(m.tools)) {
    for (const t of m.tools) {
      if (
        t !== null &&
        typeof t === 'object' &&
        typeof (t as { tool?: unknown }).tool === 'string'
      ) {
        const chip = t as { tool: string; detail?: unknown };
        parts.push({
          kind: 'tool',
          tool: chip.tool,
          detail: typeof chip.detail === 'string' ? chip.detail : '',
        });
      }
    }
  }
  return parts;
}

function normalizeMessage(x: unknown): AiMessage | null {
  if (x === null || typeof x !== 'object') return null;
  const m = x as Partial<AiMessage> & LegacyMessage;
  if (typeof m.id !== 'string' || (m.role !== 'user' && m.role !== 'assistant')) return null;
  return {
    id: m.id,
    role: m.role,
    parts: Array.isArray(m.parts) ? m.parts : legacyParts(m),
    // A persisted message is a finished turn; never rehydrate it as still in-flight.
    done: true,
    ...(typeof m.error === 'string' ? { error: m.error } : {}),
    ...(typeof m.mutations === 'number' ? { mutations: m.mutations } : {}),
    ...(m.reverted === true ? { reverted: true } : {}),
  };
}

export function readSessionMessages(
  path: string,
  id: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): AiMessage[] {
  try {
    const raw = storage.getItem(sessionKey(path, id));
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as { messages?: unknown };
    if (!Array.isArray(parsed.messages)) return [];
    return parsed.messages.map(normalizeMessage).filter((m): m is AiMessage => m !== null);
  } catch {
    return [];
  }
}

export function writeSessionMessages(
  path: string,
  id: string,
  messages: AiMessage[],
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    if (messages.length === 0) {
      storage.removeItem(sessionKey(path, id));
      return;
    }
    // Drop ephemeral parts before persisting: inline screenshot images (#1506) would blow the
    // size budget and evict the transcript, and interactive `ask_user` prompts belong to a live
    // turn (they can't be answered after a reload). The text/tool history is what's worth keeping.
    const slim = messages.map(m => ({
      ...m,
      parts: m.parts.filter(p => p.kind !== 'image' && p.kind !== 'prompt'),
    }));
    const raw = JSON.stringify({ messages: slim });
    if (raw.length > MAX_BYTES) return; // too big to persist; skip rather than throw
    storage.setItem(sessionKey(path, id), raw);
  } catch {
    /* quota exceeded or storage unavailable — non-fatal, the live transcript is intact */
  }
}

export function deleteSessionStorage(
  path: string,
  id: string,
  storage: Pick<Storage, 'removeItem'> = localStorage,
): void {
  try {
    storage.removeItem(sessionKey(path, id));
  } catch {
    /* ignore */
  }
}

export function readBillingDismissed(
  path: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): boolean {
  try {
    return storage.getItem(`${BILLING_DISMISSED_PREFIX}${path}`) === 'true';
  } catch {
    return false;
  }
}

export function writeBillingDismissed(
  path: string,
  dismissed: boolean,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    if (dismissed) storage.setItem(`${BILLING_DISMISSED_PREFIX}${path}`, 'true');
    else storage.removeItem(`${BILLING_DISMISSED_PREFIX}${path}`);
  } catch {
    /* storage unavailable — non-fatal */
  }
}
