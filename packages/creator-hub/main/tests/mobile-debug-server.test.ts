import { describe, expect, test, vi } from 'vitest';
import { broadcastCommand, sendCommand } from '../src/modules/mobile-debug-server';

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('sendCommand', () => {
  test('returns ok:false when the session does not exist', async () => {
    const result = await sendCommand(999_999, 'pause');
    expect(result.ok).toBe(false);
    expect(result.data).toEqual({ error: 'session not connected' });
  });
});

describe('broadcastCommand', () => {
  test('returns ok:false with no results when there are no sessions', async () => {
    const result = await broadcastCommand('pause');
    expect(result).toEqual({ ok: false, results: [] });
  });
});
