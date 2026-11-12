import { createHash, randomUUID } from 'crypto';
import path from 'path';

import type { AiProvider, AiShareRequest } from '/shared/types/ai';
import {
  AI_SHARING_CONSENT_VERSION,
  AI_SHARING_LIMITS,
  type AiTurnErrorKind,
  type AiTurnOutcome,
  type AiTurnRecord,
  type AiTurnUsage,
} from '/shared/types/ai-sharing';
import { prepareForSharing, redactForSharing } from '/shared/redact';

/** What one CLI line says about the run itself, as opposed to the conversation. */
export interface TurnInfo {
  model?: string;
  cliVersion?: string;
  usage?: AiTurnUsage;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

/**
 * Reads the model, CLI version and token usage each CLI reports. Each one reports a different
 * subset: Codex never names its model, Cursor reports no usage. Unknown lines return undefined.
 */
export function readTurnInfo(provider: AiProvider, line: string): TurnInfo | undefined {
  let obj: Record<string, any>;
  try {
    obj = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (obj === null || typeof obj !== 'object') return undefined;

  if (provider === 'claude' || provider === 'cursor') {
    if (obj.type === 'system' && obj.subtype === 'init') {
      return { model: text(obj.model), cliVersion: text(obj.claude_code_version) };
    }
    if (obj.type === 'result' && obj.usage !== undefined && obj.usage !== null) {
      const u = obj.usage;
      return {
        usage: {
          // Claude reports cached input separately; together they are what the turn read.
          inputTokens:
            num(u.input_tokens) +
            num(u.cache_read_input_tokens) +
            num(u.cache_creation_input_tokens),
          outputTokens: num(u.output_tokens),
          costUsd: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : null,
        },
      };
    }
  }
  if (provider === 'codex' && obj.type === 'turn.completed' && obj.usage) {
    return {
      usage: {
        inputTokens: num(obj.usage.input_tokens),
        outputTokens: num(obj.usage.output_tokens),
        costUsd: null,
      },
    };
  }
  if (provider === 'gemini') {
    if (obj.type === 'init') return { model: text(obj.model) };
    if (obj.type === 'result' && obj.stats) {
      return {
        usage: {
          inputTokens: num(obj.stats.input_tokens),
          outputTokens: num(obj.stats.output_tokens),
          costUsd: null,
        },
      };
    }
  }
  return undefined;
}

/** Everything main gathers about one turn while it runs. */
export interface TurnCapture {
  address: string;
  conversationId: string;
  turnId: string;
  share: AiShareRequest;
  startedAt: number;
  appVersion: string;
  os: string;
  provider: AiProvider;
  requestedModel: string;
  systemPrompt: string;
  prompt: string;
  attachments: { name: string; kind: string }[];
  projectId: string | null;
  info: TurnInfo;
  responseParts: string[];
  tools: [string, string][];
}

export interface TurnEnd {
  outcome: AiTurnOutcome;
  errorKind: AiTurnErrorKind | null;
  mutations: number;
  endedAt: number;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const byteLength = (record: AiTurnRecord): number =>
  Buffer.byteLength(JSON.stringify(record), 'utf8');

/**
 * The record for one finished turn: redacted, truncated and within the size cap. Any text a
 * user typed or an agent wrote goes through `redactForSharing`; nothing else carries content.
 */
export function buildTurnRecord(capture: TurnCapture, end: TurnEnd): AiTurnRecord | null {
  const tools = capture.tools.slice(0, AI_SHARING_LIMITS.maxTools).map(([name, detail]) => ({
    name: Array.from(name).slice(0, AI_SHARING_LIMITS.toolNameChars).join(''),
    detail: redactForSharing(detail, AI_SHARING_LIMITS.toolDetailChars),
  }));
  const record: AiTurnRecord = {
    schemaVersion: 1,
    recordId: randomUUID(),
    consentVersion: AI_SHARING_CONSENT_VERSION,
    address: capture.address.toLowerCase(),
    conversationId: capture.conversationId,
    turnId: capture.turnId,
    turnIndex: capture.share.turnIndex,
    startedAt: new Date(capture.startedAt).toISOString(),
    durationMs: Math.max(0, end.endedAt - capture.startedAt),
    app: { version: capture.appVersion, os: capture.os },
    agent: {
      provider: capture.provider,
      requestedModel: capture.requestedModel,
      actualModel: capture.info.model ?? null,
      cliVersion: capture.info.cliVersion ?? null,
    },
    systemPromptHash: sha256(capture.systemPrompt),
    prompt: redactForSharing(capture.prompt, AI_SHARING_LIMITS.promptChars),
    context: {
      selectedEntityCount: capture.share.selectedEntityCount,
      mentionedAssetCount: capture.share.mentionedAssetCount,
      attachments: capture.attachments.map(a => ({
        kind: a.kind,
        ext: path.extname(a.name).toLowerCase().slice(0, 12),
      })),
    },
    response: redactForSharing(capture.responseParts.join(''), AI_SHARING_LIMITS.responseChars),
    tools,
    outcome: end.outcome,
    errorKind: end.errorKind,
    mutations: end.mutations,
    usage: capture.info.usage ?? null,
    projectId: capture.projectId,
  };
  return fitWithinCap(record, capture);
}

// Text limits are in characters, the cap in bytes: a reply in a multi-byte script, or text JSON
// has to escape, can pass the first and break the second. Shrink the reply, then the tool details,
// then the prompt; a record that still doesn't fit is not shared (null). Each text is redacted
// once here, however many lengths are tried.
function fitWithinCap(record: AiTurnRecord, capture: TurnCapture): AiTurnRecord | null {
  if (byteLength(record) <= AI_SHARING_LIMITS.recordBytes) return record;
  const response = prepareForSharing(capture.responseParts.join(''));
  let limit: number = AI_SHARING_LIMITS.responseChars;
  while (byteLength(record) > AI_SHARING_LIMITS.recordBytes && limit > 1_000) {
    limit = Math.floor(limit / 2);
    record.response = response(limit);
  }
  if (byteLength(record) > AI_SHARING_LIMITS.recordBytes) {
    record.tools = record.tools.map(t => ({ ...t, detail: redactForSharing('', 0) }));
  }
  const prompt = prepareForSharing(capture.prompt);
  limit = AI_SHARING_LIMITS.promptChars;
  while (byteLength(record) > AI_SHARING_LIMITS.recordBytes && limit > 1_000) {
    limit = Math.floor(limit / 2);
    record.prompt = prompt(limit);
  }
  return byteLength(record) <= AI_SHARING_LIMITS.recordBytes ? record : null;
}
