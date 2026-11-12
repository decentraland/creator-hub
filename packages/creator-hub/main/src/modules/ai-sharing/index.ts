import path from 'path';
import log from 'electron-log/main';

import type { AiSendParams } from '/shared/types/ai';
import { consentFor, hasSharingConsent, type AiTurnRecord } from '/shared/types/ai-sharing';

import { getUserId } from '../analytics';
import { getAppVersion, getUserDataPath } from '../electron';
import { Outbox } from './outbox';
import {
  buildTurnRecord,
  readTurnInfo,
  type TurnCapture,
  type TurnEnd,
  type TurnInfo,
} from './record';

export { readTurnInfo, type TurnInfo };

let outbox: Outbox | null = null;

export function getOutbox(): Outbox {
  outbox ??= new Outbox(path.join(getUserDataPath(), 'ai-sharing', 'outbox'));
  return outbox;
}

/**
 * Whether this turn may be recorded. The renderer asks (`params.share`), but main checks the
 * saved consent and the signed-in address itself, so a renderer bug can't record a turn the
 * user never agreed to share.
 */
export async function sharingAddress(params: AiSendParams): Promise<string | null> {
  if (params.share === undefined) return null;
  const address = getUserId();
  if (address === null || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  try {
    // Loaded lazily, like ai.ts's session store: config pulls in the Electron app, and ai.ts
    // (which imports this module) must stay importable in unit tests.
    const { getConfigStorage } = await import('../config');
    const settings = await (await getConfigStorage()).get('settings');
    return hasSharingConsent(consentFor(settings?.aiDataSharing, address)) ? address : null;
  } catch (e) {
    log.warn('[AI sharing] could not read consent; not recording this turn', e);
    return null;
  }
}

// Conversations the creator stopped sharing. A turn already running in one of them must not be
// queued when it ends; the renderer persists the choice and repeats it here on every change.
const excludedConversations = new Set<string>();

export function setConversationShared(conversationId: string, shared: boolean): void {
  if (shared) {
    excludedConversations.delete(conversationId);
    return;
  }
  excludedConversations.add(conversationId);
  getOutbox().purgeConversation(conversationId);
}

export const isConversationExcluded = (conversationId: string): boolean =>
  excludedConversations.has(conversationId);

export type CaptureStart = Omit<
  TurnCapture,
  'appVersion' | 'os' | 'info' | 'responseParts' | 'tools'
>;

/** Collects one turn while it runs. `finish` builds the record and queues it, once. */
export class TurnRecorder {
  private readonly capture: TurnCapture;
  private finished = false;

  constructor(start: CaptureStart, appVersion: string) {
    this.capture = {
      ...start,
      appVersion,
      os: process.platform,
      info: {},
      responseParts: [],
      tools: [],
    };
  }

  static async start(start: CaptureStart): Promise<TurnRecorder> {
    return new TurnRecorder(start, await getAppVersion());
  }

  onText(text: string): void {
    this.capture.responseParts.push(text);
  }

  onTool(name: string, detail: string): void {
    this.capture.tools.push([name, detail]);
  }

  /**
   * Builds and queues the record, once. `stillShared` runs first: consent, the account or the
   * conversation's exclusion can change while a turn runs, and the answer at the end is the
   * one that counts.
   */
  async finish(
    end: TurnEnd,
    info: TurnInfo,
    stillShared: () => Promise<boolean>,
    queue: (record: AiTurnRecord) => void = r => getOutbox().enqueue(r),
  ): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    try {
      if (isConversationExcluded(this.capture.conversationId) || !(await stillShared())) return;
      const record = buildTurnRecord({ ...this.capture, info }, end);
      if (record === null) {
        log.warn(`[AI sharing] turn ${this.capture.turnId} is too large to share; not queued`);
        return;
      }
      queue(record);
    } catch (e) {
      // Never let sharing break a turn: the record is lost, the conversation isn't.
      log.warn('[AI sharing] could not queue the turn record', e);
    }
  }
}
