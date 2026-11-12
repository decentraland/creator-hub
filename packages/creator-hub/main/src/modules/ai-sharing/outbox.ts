import fs from 'fs';
import path from 'path';

import type { AiSharingQueuedItem, AiTurnRecord } from '/shared/types/ai-sharing';

/**
 * Shared turns wait here, one JSON file each, until the renderer uploads them. On disk so a
 * crash or quit doesn't lose them; bounded so an account that never signs in again can't grow
 * it forever. Everything in here is already redacted.
 */
export const OUTBOX_LIMITS = {
  maxRecords: 500,
  maxBytes: 20 * 1024 * 1024,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
} as const;

// `<wallet>.<recordId>.json`: the wallet in the name lets a wallet's reads skip every other
// wallet's files without opening them.
const RECORD_FILE = /^(0x[0-9a-f]{40})\.([0-9a-f-]{36})\.json$/;
const RECORD_ID = /^[0-9a-f-]{36}$/;
// Long enough that a write in progress is never taken for a leftover.
const TEMP_FILE_GRACE_MS = 60_000;

interface Entry {
  file: string;
  address: string;
  recordId: string;
  mtimeMs: number;
  size: number;
}

export class Outbox {
  constructor(private readonly dir: string) {}

  enqueue(record: AiTurnRecord): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const file = path.join(this.dir, `${record.address}.${record.recordId}.json`);
    // Write-then-rename so a crash mid-write leaves no half file for the uploader to choke on.
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 });
    fs.renameSync(tmp, file);
    this.prune();
  }

  /** The oldest `limit` records of `address`, oldest first. Expired records are dropped first. */
  peek(address: string, limit: number): AiTurnRecord[] {
    this.prune();
    const out: AiTurnRecord[] = [];
    for (const entry of this.entries(address)) {
      if (out.length >= limit) break;
      const record = this.read(entry.file);
      if (record !== null) out.push(record);
    }
    return out;
  }

  ack(recordIds: string[]): void {
    const ids = new Set(recordIds.filter(id => RECORD_ID.test(id)));
    for (const entry of this.entries()) {
      if (ids.has(entry.recordId)) fs.rmSync(entry.file, { force: true });
    }
  }

  /** What Settings shows of one wallet's queue. Expired records are dropped first. */
  list(address: string): AiSharingQueuedItem[] {
    this.prune();
    return this.entries(address).flatMap(entry => {
      const record = this.read(entry.file);
      if (record === null) return [];
      return [
        {
          recordId: record.recordId,
          address: record.address,
          startedAt: record.startedAt,
          provider: record.agent.provider,
          promptPreview: Array.from(record.prompt.text).slice(0, 140).join(''),
        },
      ];
    });
  }

  count(): number {
    return this.entries().length;
  }

  /** Drops the queued records of one conversation (the creator stopped sharing it). */
  purgeConversation(conversationId: string): void {
    for (const entry of this.entries()) {
      if (this.read(entry.file)?.conversationId === conversationId) {
        fs.rmSync(entry.file, { force: true });
      }
    }
  }

  /** Drops one wallet's queued records (it said no, or erased what it shared). */
  purge(address: string): void {
    for (const entry of this.entries(address)) fs.rmSync(entry.file, { force: true });
  }

  /** Drops records past the age limit, then the oldest until the count and size limits hold. */
  prune(now = Date.now()): void {
    this.removeStaleTempFiles(now);
    let entries = this.entries();
    for (const entry of entries) {
      if (now - entry.mtimeMs > OUTBOX_LIMITS.maxAgeMs) fs.rmSync(entry.file, { force: true });
    }
    entries = this.entries();
    let total = entries.reduce((sum, e) => sum + e.size, 0);
    while (
      entries.length > 0 &&
      (entries.length > OUTBOX_LIMITS.maxRecords || total > OUTBOX_LIMITS.maxBytes)
    ) {
      const oldest = entries.shift()!;
      fs.rmSync(oldest.file, { force: true });
      total -= oldest.size;
    }
  }

  // A crash between write and rename leaves a `.tmp` that no listing sees; it is never renamed.
  private removeStaleTempFiles(now: number): void {
    for (const name of this.names()) {
      if (!name.endsWith('.json.tmp')) continue;
      const file = path.join(this.dir, name);
      try {
        if (now - fs.statSync(file).mtimeMs > TEMP_FILE_GRACE_MS) fs.rmSync(file, { force: true });
      } catch {
        // Gone already.
      }
    }
  }

  private names(): string[] {
    try {
      return fs.readdirSync(this.dir);
    } catch {
      return [];
    }
  }

  /** Queued records, oldest first; only `address`'s when given. */
  private entries(address?: string): Entry[] {
    const wanted = address?.toLowerCase();
    return this.names()
      .flatMap(name => {
        const match = RECORD_FILE.exec(name);
        if (match === null || (wanted !== undefined && match[1] !== wanted)) return [];
        const file = path.join(this.dir, name);
        try {
          const stat = fs.statSync(file);
          return [
            { file, address: match[1], recordId: match[2], mtimeMs: stat.mtimeMs, size: stat.size },
          ];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs);
  }

  private read(file: string): AiTurnRecord | null {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      // Locked by an antivirus scan, out of file handles…: try again next time, never delete.
      return null;
    }
    try {
      const parsed = JSON.parse(text) as AiTurnRecord;
      if (typeof parsed?.recordId === 'string' && typeof parsed.address === 'string') return parsed;
    } catch {
      // Falls through: not JSON.
    }
    // Readable but broken (hand-edited, truncated by a disk error): it can never upload, so it
    // must not block the queue.
    fs.rmSync(file, { force: true });
    return null;
  }
}
