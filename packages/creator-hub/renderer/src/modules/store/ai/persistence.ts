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
import type { AiMessage, AiSessionMeta } from './types';

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

export function readSessionMessages(
  path: string,
  id: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): AiMessage[] {
  try {
    const raw = storage.getItem(sessionKey(path, id));
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as { messages?: unknown };
    return Array.isArray(parsed.messages) ? (parsed.messages as AiMessage[]) : [];
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
    // Drop inline screenshot images (#1506): a few base64 PNGs would blow the size budget
    // and evict the transcript. They're ephemeral — the text/tool history is what's worth
    // keeping across restarts. Interactive `ask_user` prompts are ephemeral too (they belong
    // to a live turn and can't be answered after a reload), so drop those messages entirely.
    const slim = messages
      .filter(m => m.prompt === undefined)
      .map(m => (m.images === undefined ? m : { ...m, images: undefined }));
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
