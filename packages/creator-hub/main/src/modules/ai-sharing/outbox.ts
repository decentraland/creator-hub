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

const RECORD_FILE = /^[0-9a-f-]{36}\.json$/;

export class Outbox {
  constructor(private readonly dir: string) {}

  enqueue(record: AiTurnRecord): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const file = path.join(this.dir, `${record.recordId}.json`);
    // Write-then-rename so a crash mid-write leaves no half file for the uploader to choke on.
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 });
    fs.renameSync(tmp, file);
    this.prune();
  }

  /** The oldest `limit` records signed for `address`, oldest first. */
  peek(address: string, limit: number): AiTurnRecord[] {
    const wanted = address.toLowerCase();
    const out: AiTurnRecord[] = [];
    for (const entry of this.entries()) {
      if (out.length >= limit) break;
      const record = this.read(entry.file);
      if (record?.address === wanted) out.push(record);
    }
    return out;
  }

  ack(recordIds: string[]): void {
    for (const id of recordIds) {
      if (!/^[0-9a-f-]{36}$/.test(id)) continue;
      fs.rmSync(path.join(this.dir, `${id}.json`), { force: true });
    }
  }

  list(): AiSharingQueuedItem[] {
    return this.entries().flatMap(entry => {
      const record = this.read(entry.file);
      if (record === null) return [];
      return [
        {
          recordId: record.recordId,
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

  purge(): void {
    fs.rmSync(this.dir, { recursive: true, force: true });
  }

  /** Drops records past the age limit, then the oldest until the count and size limits hold. */
  prune(now = Date.now()): void {
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

  private entries(): { file: string; mtimeMs: number; size: number }[] {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return [];
    }
    return names
      .filter(name => RECORD_FILE.test(name))
      .flatMap(name => {
        const file = path.join(this.dir, name);
        try {
          const stat = fs.statSync(file);
          return [{ file, mtimeMs: stat.mtimeMs, size: stat.size }];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.mtimeMs - b.mtimeMs);
  }

  private read(file: string): AiTurnRecord | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as AiTurnRecord;
      return typeof parsed?.recordId === 'string' && typeof parsed.address === 'string'
        ? parsed
        : null;
    } catch {
      // Unreadable or hand-edited: it can never upload, so don't let it block the queue.
      fs.rmSync(file, { force: true });
      return null;
    }
  }
}
