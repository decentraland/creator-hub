/**
 * Per-project persistence of the AI chat transcript, so a conversation survives an app
 * restart. Keyed by the project path and stored in localStorage (the renderer origin is
 * stable across restarts). The provider session ids that make `--resume` continue are
 * persisted separately by the main process (ai.ts), keyed by the same project path — the
 * two are coordinated only by that path.
 */
import type { AiMessage } from './types';

const KEY_PREFIX = 'creator-hub:ai-conversation:';
// Per-project dismissal of the "uses your own account" billing hint (#1505). Kept apart
// from the transcript so clearing the chat doesn't bring the hint back.
const BILLING_DISMISSED_PREFIX = 'creator-hub:ai-billing-dismissed:';
// localStorage is ~5MB per origin; keep one conversation well under that. A transcript
// larger than this just isn't persisted (the live one still works) rather than throwing.
const MAX_BYTES = 1_000_000;

function key(path: string): string {
  return `${KEY_PREFIX}${path}`;
}

export function readConversation(
  path: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): AiMessage[] {
  try {
    const raw = storage.getItem(key(path));
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as { messages?: unknown };
    return Array.isArray(parsed.messages) ? (parsed.messages as AiMessage[]) : [];
  } catch {
    return []; // unavailable or corrupt — start empty
  }
}

export function writeConversation(
  path: string,
  messages: AiMessage[],
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    if (messages.length === 0) {
      storage.removeItem(key(path));
      return;
    }
    const raw = JSON.stringify({ messages });
    if (raw.length > MAX_BYTES) return; // too big to persist; skip rather than throw
    storage.setItem(key(path), raw);
  } catch {
    /* quota exceeded or storage unavailable — non-fatal, the live transcript is intact */
  }
}

export function clearStoredConversation(
  path: string,
  storage: Pick<Storage, 'removeItem'> = localStorage,
): void {
  try {
    storage.removeItem(key(path));
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
