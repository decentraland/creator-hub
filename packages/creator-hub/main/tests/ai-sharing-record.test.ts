import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AI_SHARING_LIMITS, type AiTurnRecord } from '/shared/types/ai-sharing';
import { Outbox, OUTBOX_LIMITS } from '../src/modules/ai-sharing/outbox';
import {
  buildTurnRecord,
  readTurnInfo,
  sha256,
  type TurnCapture,
} from '../src/modules/ai-sharing/record';

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const capture = (overrides: Partial<TurnCapture> = {}): TurnCapture => ({
  address: ADDRESS.toUpperCase().replace('0X', '0x'),
  conversationId: 'c1',
  turnId: 't-1',
  share: { turnIndex: 2, selectedEntityCount: 1, mentionedAssetCount: 3 },
  startedAt: Date.parse('2026-11-12T10:00:00Z'),
  appVersion: '1.2.3',
  os: 'darwin',
  provider: 'claude',
  requestedModel: 'default',
  systemPrompt: 'rules',
  prompt: 'add a door, my key is sk-ant-api03-exampleexampleexample00',
  attachments: [{ name: '/Users/jane/Desktop/Shot.PNG', kind: 'image' }],
  projectId: 'p1',
  info: {
    model: 'claude-sonnet-example',
    usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.01 },
  },
  responseParts: ['Added the door. ', 'Email jane.doe@example.com for help.'],
  tools: [['Edit', 'src/index.ts']],
  ...overrides,
});

const end = {
  outcome: 'ok' as const,
  errorKind: null,
  mutations: 2,
  endedAt: Date.parse('2026-11-12T10:00:04Z'),
};

describe('when reading what a CLI reports about its run', () => {
  it('should read the model and version from claude init', () => {
    const line = JSON.stringify({
      type: 'system',
      subtype: 'init',
      model: 'claude-sonnet-example',
      claude_code_version: '2.0.0',
    });

    expect(readTurnInfo('claude', line)).toEqual({
      model: 'claude-sonnet-example',
      cliVersion: '2.0.0',
    });
  });

  it('should add cached input to claude input tokens and keep the cost', () => {
    const line = JSON.stringify({
      type: 'result',
      usage: {
        input_tokens: 10,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 5,
        output_tokens: 7,
      },
      total_cost_usd: 0.25,
    });

    expect(readTurnInfo('claude', line)).toEqual({
      usage: { inputTokens: 115, outputTokens: 7, costUsd: 0.25 },
    });
  });

  it('should read codex usage from turn.completed', () => {
    const line = JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 3, output_tokens: 4 },
    });

    expect(readTurnInfo('codex', line)).toEqual({
      usage: { inputTokens: 3, outputTokens: 4, costUsd: null },
    });
  });

  it('should read the gemini model and stats', () => {
    expect(
      readTurnInfo('gemini', JSON.stringify({ type: 'init', model: 'gemini-example' })),
    ).toEqual({
      model: 'gemini-example',
    });
    expect(
      readTurnInfo(
        'gemini',
        JSON.stringify({ type: 'result', stats: { input_tokens: 1, output_tokens: 2 } }),
      ),
    ).toEqual({ usage: { inputTokens: 1, outputTokens: 2, costUsd: null } });
  });

  it('should ignore other lines and non-JSON output', () => {
    expect(readTurnInfo('claude', JSON.stringify({ type: 'assistant' }))).toBeUndefined();
    expect(readTurnInfo('claude', 'Reconnecting…')).toBeUndefined();
  });
});

describe('when building the record for a shared turn', () => {
  it('should redact what the user typed and what the agent wrote', () => {
    const record = buildTurnRecord(capture(), end);

    expect(record.prompt.text).toBe('add a door, my key is <api_key>');
    expect(record.prompt.redactions).toEqual({ api_key: 1 });
    expect(record.response.text).toBe('Added the door. Email <email> for help.');
  });

  it('should keep only the extension of an attachment, never its path or name', () => {
    const record = buildTurnRecord(capture(), end);

    expect(record.context.attachments).toEqual([{ kind: 'image', ext: '.png' }]);
    expect(JSON.stringify(record)).not.toContain('jane');
    expect(JSON.stringify(record)).not.toContain('Shot');
  });

  it('should hash the system prompt instead of including it', () => {
    const record = buildTurnRecord(capture(), end);

    expect(record.systemPromptHash).toBe(sha256('rules'));
    expect(JSON.stringify(record)).not.toContain('"rules"');
  });

  it('should carry the model, usage, timing and a lowercase address', () => {
    const record = buildTurnRecord(capture(), end);

    expect(record).toMatchObject({
      schemaVersion: 1,
      address: ADDRESS,
      turnIndex: 2,
      durationMs: 4000,
      startedAt: '2026-11-12T10:00:00.000Z',
      agent: {
        provider: 'claude',
        requestedModel: 'default',
        actualModel: 'claude-sonnet-example',
      },
      usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.01 },
      outcome: 'ok',
      mutations: 2,
    });
  });

  it('should stay under the size cap when the reply is huge and multi-byte', () => {
    const record = buildTurnRecord(capture({ responseParts: ['界'.repeat(200_000)] }), end);

    expect(Buffer.byteLength(JSON.stringify(record))).toBeLessThanOrEqual(
      AI_SHARING_LIMITS.recordBytes,
    );
    expect(record.response.truncated).toBe(true);
    expect(record.response.originalLength).toBe(200_000);
  });

  it('should cap the number of tools and the length of each detail', () => {
    const tools = Array.from({ length: 300 }, (): [string, string] => ['Bash', 'x'.repeat(2_000)]);
    const record = buildTurnRecord(capture({ tools }), end);

    expect(record.tools).toHaveLength(AI_SHARING_LIMITS.maxTools);
    expect(record.tools[0].detail.truncated).toBe(true);
  });
});

describe('when queuing records on disk', () => {
  let dir: string;
  let outbox: Outbox;
  const record = (address = ADDRESS): AiTurnRecord => ({
    ...buildTurnRecord(capture(), end),
    address,
  });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-outbox-'));
    outbox = new Outbox(path.join(dir, 'outbox'));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('should hand back only the records signed for the given address', () => {
    const mine = record();
    outbox.enqueue(mine);
    outbox.enqueue(record('0x000000000000000000000000000000000000dead'));

    expect(outbox.peek(ADDRESS.toUpperCase().replace('0X', '0x'), 10).map(r => r.recordId)).toEqual(
      [mine.recordId],
    );
  });

  it('should forget acknowledged records', () => {
    const r = record();
    outbox.enqueue(r);
    outbox.ack([r.recordId]);

    expect(outbox.count()).toBe(0);
  });

  it('should ignore an acknowledgement that is not a record id', () => {
    outbox.enqueue(record());
    outbox.ack(['../../etc/passwd']);

    expect(outbox.count()).toBe(1);
  });

  it('should list a short prompt preview for Settings', () => {
    outbox.enqueue(record());

    expect(outbox.list()).toEqual([
      expect.objectContaining({
        provider: 'claude',
        promptPreview: 'add a door, my key is <api_key>',
      }),
    ]);
  });

  it('should delete everything on purge', () => {
    outbox.enqueue(record());
    outbox.purge();

    expect(outbox.count()).toBe(0);
    expect(fs.existsSync(path.join(dir, 'outbox'))).toBe(false);
  });

  it('should drop records older than the age limit', () => {
    outbox.enqueue(record());
    outbox.prune(Date.now() + OUTBOX_LIMITS.maxAgeMs + 1_000);

    expect(outbox.count()).toBe(0);
  });

  it('should drop the oldest records past the count limit', () => {
    for (let i = 0; i < OUTBOX_LIMITS.maxRecords + 3; i++) outbox.enqueue(record());

    expect(outbox.count()).toBe(OUTBOX_LIMITS.maxRecords);
  });

  it('should discard an unreadable file instead of blocking the queue', () => {
    outbox.enqueue(record());
    fs.writeFileSync(
      path.join(dir, 'outbox', '00000000-0000-0000-0000-000000000000.json'),
      '{oops',
    );

    expect(outbox.peek(ADDRESS, 10)).toHaveLength(1);
    expect(outbox.count()).toBe(1);
  });
});
