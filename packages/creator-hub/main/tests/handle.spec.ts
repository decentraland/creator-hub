import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), on: vi.fn() } }));
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@sentry/electron/main', () => ({ captureException: vi.fn() }));
vi.mock('../src/modules/bin', () => ({ StreamError: class StreamError extends Error {} }));

import { ipcMain } from 'electron';
import log from 'electron-log';
import { captureException } from '@sentry/electron/main';

import { formatArgs, handle, handleSync } from '../src/modules/handle';

describe('formatArgs', () => {
  describe.each(['authChain', 'auth_chain', 'auth-chain'])(
    'when an argument carries an %s key',
    key => {
      it('should redact it', () => {
        const line = formatArgs([{ parcel: '0,0', [key]: [{ signature: '0xdef' }] }]);
        expect(line).toBe(`args[0]={"parcel":"0,0","${key}":"[redacted]"}`);
      });
    },
  );

  describe('when an argument holds a data URL', () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(1000)}`;

    it('should shorten it wherever it is nested', () => {
      expect(formatArgs([{ shot: { url: dataUrl } }])).toBe(
        `args[0]={"shot":{"url":"[data:image/png, ${dataUrl.length} bytes]"}}`,
      );
    });

    it('should shorten it when it is the argument itself', () => {
      expect(formatArgs([dataUrl])).toBe(`args[0]="[data:image/png, ${dataUrl.length} bytes]"`);
    });
  });

  describe('when an argument carries credentials', () => {
    /** The shape `metrics.request` puts on the wire. */
    const request = {
      baseUrl: 'https://places.decentraland.org',
      path: '/metrics',
      headers: {
        'x-identity-auth-chain-0': '{"type":"SIGNER","payload":"0xabc"}',
        'x-identity-auth-chain-1': '{"type":"ECDSA_EPHEMERAL","signature":"0xdef"}',
        'x-identity-timestamp': '1767225600000',
        'x-identity-metadata': '{"signer":"dcl:creator-hub"}',
      },
      body: { locations: [{ x: 0, y: 0 }] },
    };

    it('should keep the signed values out of the log line', () => {
      const line = formatArgs([request]);

      expect(line).not.toContain('0xabc');
      expect(line).not.toContain('0xdef');
      expect(line).not.toContain('ECDSA_EPHEMERAL');
      expect(line).not.toContain('1767225600000');
      expect(line).not.toContain('dcl:creator-hub');
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

  describe.each([
    ['an email', { method: 'email', value: 'jane.doe@example.com' }],
    ['a Discord username', { method: 'discord', value: 'fixture_user' }],
  ])('when an argument is an issue report with %s contact', (_, contact) => {
    const report = {
      message: 'Publishing failed twice',
      contact,
      includeLogs: true,
      source: 'logo-menu',
    };

    it('should mask the contact', () => {
      expect(formatArgs([report])).not.toContain(contact.value);
    });

    it('should keep the description readable', () => {
      expect(formatArgs([report])).toContain('"message":"Publishing failed twice"');
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

describe('handle', () => {
  describe.each([
    ['ai.submitSignInCode', ['SIGN-IN-CODE-123']],
    ['ai.send', ['/scenes/a', { text: 'PROMPT TEXT', attachments: [{ data: 'IMAGE' }] }]],
    ['ai.screenshotResult', ['shot-1', 'data:image/png;base64,SCREENSHOT']],
    ['ai.askResult', ['ask-1', 'ANSWER TEXT']],
    ['ai.mirrorPush', [{ messages: [{ text: 'PROMPT TEXT' }] }]],
    ['ai.remoteCommand', [{ type: 'send', text: 'PROMPT TEXT' }]],
  ] as const)('when %s is called', (channel, args) => {
    it('should log the channel without its arguments', async () => {
      vi.mocked(log.info).mockClear();
      vi.mocked(ipcMain.handle).mockClear();
      handle(channel, vi.fn() as never);
      const listener = vi.mocked(ipcMain.handle).mock.calls[0][1];

      await listener({} as never, ...args);

      expect(log.info).toHaveBeenCalledWith(`[IPC] channel=${channel} [redacted]`);
    });
  });

  describe.each([
    ['feedback.send', 0],
    ['ai.deleteSession', 1],
  ] as const)('when the %s handler rejects', (channel, captures) => {
    it(`should log the error, return it, and report it to Sentry ${captures} time(s)`, async () => {
      vi.mocked(log.error).mockClear();
      vi.mocked(captureException).mockClear();
      vi.mocked(ipcMain.handle).mockClear();
      handle(channel, vi.fn().mockRejectedValue(new Error('boom')) as never);
      const listener = vi.mocked(ipcMain.handle).mock.calls[0][1];

      const result = await listener({} as never);

      expect(log.error).toHaveBeenCalledWith(`[IPC] channel=${channel} name=Error error=boom`);
      expect(result).toEqual({ success: false, error: { message: 'boom', name: 'Error' } });
      expect(captureException).toHaveBeenCalledTimes(captures);
    });
  });

  describe('when a channel without content is called', () => {
    it('should log its arguments', async () => {
      vi.mocked(log.info).mockClear();
      vi.mocked(ipcMain.handle).mockClear();
      handle('ai.deleteSession', vi.fn() as never);
      const listener = vi.mocked(ipcMain.handle).mock.calls[0][1];

      await listener({} as never, '/scenes/a', 'session-1');

      expect(log.info).toHaveBeenCalledWith(
        '[IPC] channel=ai.deleteSession args[0]="/scenes/a" args[1]="session-1"',
      );
    });
  });
});

describe('handleSync', () => {
  describe('when a content channel is called', () => {
    it('should log the channel without its arguments', () => {
      vi.mocked(log.info).mockClear();
      vi.mocked(ipcMain.on).mockClear();
      handleSync('ai.send', vi.fn() as never);
      const listener = vi.mocked(ipcMain.on).mock.calls[0][1];

      listener({} as never, '/scenes/a', { text: 'PROMPT TEXT' });

      expect(log.info).toHaveBeenCalledWith('[IPC-SYNC] channel=ai.send [redacted]');
    });
  });
});
