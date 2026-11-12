import type { AiProvider } from './ai';

/**
 * Bump when the consent text or what a record holds changes: everyone who said yes is asked
 * again, and records are only collected under the version the user accepted.
 */
export const AI_SHARING_CONSENT_VERSION = 1;

/** Persisted under `AppSettings.aiDataSharing`. Absent means the user was never asked. */
export interface AiSharingConsent {
  consent: 'granted' | 'denied';
  version: number;
  decidedAt: string;
}

/** True only for a yes to the current consent text. */
export function hasSharingConsent(consent: AiSharingConsent | undefined): boolean {
  return consent?.consent === 'granted' && consent.version === AI_SHARING_CONSENT_VERSION;
}

export const AI_SHARING_LIMITS = {
  promptChars: 16_000,
  responseChars: 32_000,
  toolDetailChars: 500,
  maxTools: 200,
  recordBytes: 128_000,
} as const;

export interface RedactedText {
  text: string;
  originalLength: number;
  truncated: boolean;
  /** How many matches each rule replaced, e.g. `{ api_key: 1, email: 2 }`. */
  redactions: Record<string, number>;
}

export type AiTurnOutcome = 'ok' | 'error' | 'cancelled';

export type AiTurnErrorKind = 'start_failed' | 'sign_in' | 'no_reply' | 'exit_code' | 'signal';

export interface AiTurnUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

/** One assistant turn, as uploaded. The wire contract with the creators-data service. */
export interface AiTurnRecord {
  schemaVersion: 1;
  recordId: string;
  consentVersion: number;
  address: string;

  conversationId: string;
  turnId: string;
  turnIndex: number;
  startedAt: string;
  durationMs: number;

  app: { version: string; os: string };
  agent: {
    provider: AiProvider;
    requestedModel: string;
    actualModel: string | null;
    cliVersion: string | null;
  };
  systemPromptHash: string;

  prompt: RedactedText;
  context: {
    selectedEntityCount: number;
    mentionedAssetCount: number;
    attachments: { kind: string; ext: string }[];
  };
  response: RedactedText;
  tools: { name: string; detail: RedactedText }[];

  outcome: AiTurnOutcome;
  errorKind: AiTurnErrorKind | null;
  mutations: number;
  usage: AiTurnUsage | null;
  projectId: string;
}

/** What Settings shows for a queued record: enough to recognise it, nothing more. */
export interface AiSharingQueuedItem {
  recordId: string;
  startedAt: string;
  provider: AiProvider;
  promptPreview: string;
}
