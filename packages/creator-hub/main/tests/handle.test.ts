import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), on: vi.fn() } }));
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@sentry/electron/main', () => ({ captureException: vi.fn() }));
vi.mock('../src/modules/bin', () => ({ StreamError: class StreamError extends Error {} }));

import { formatArgs } from '../src/modules/handle';

describe('formatArgs', () => {
  describe('when an argument carries credentials', () => {
    /** The shape `metrics.request` puts on the wire. */
    const request = {
      baseUrl: 'https://places.decentraland.org',
      path: '/metrics',
      headers: {
        'x-identity-auth-chain-0': '{"type":"SIGNER","payload":"0xabc"}',
        'x-identity-auth-chain-1': '{"type":"ECDSA_EPHEMERAL","signature":"0xdef"}',
      },
      body: { locations: [{ x: 0, y: 0 }] },
    };

    it('should keep the signed values out of the log line', () => {
      const line = formatArgs([request]);

      expect(line).not.toContain('0xabc');
      expect(line).not.toContain('0xdef');
      expect(line).not.toContain('ECDSA_EPHEMERAL');
    });

    it('should still log everything else', () => {
      const line = formatArgs([request]);

      expect(line).toContain('args[0]=');
      expect(line).toContain('https://places.decentraland.org');
      expect(line).toContain('/metrics');
    });

    it('should redact other credential-shaped keys wherever they are nested', () => {
      const line = formatArgs([
        { authorization: 'Bearer t0ken', nested: { password: 'hunter2', apiToken: 'abc' } },
      ]);

      expect(line).not.toContain('Bearer t0ken');
      expect(line).not.toContain('hunter2');
      expect(line).not.toContain('abc');
    });
  });

  describe('when arguments carry nothing sensitive', () => {
    it('should format them positionally', () => {
      expect(formatArgs(['scene-1', { open: true }])).toBe(
        'args[0]="scene-1" args[1]={"open":true}',
      );
    });

    it('should return an empty string for no arguments', () => {
      expect(formatArgs([])).toBe('');
    });
  });
});
