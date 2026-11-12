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

  describe('when the channel carries AI content', () => {
    const params = {
      provider: 'claude',
      text: 'my seed is example words and my email is jane.doe@example.com',
      context: 'selected entity "Secret Door"',
      attachments: [{ name: 'shot.png', dataUrl: 'data:image/png;base64,AAAA' }],
      apiKeyFromEnv: false,
    };

    it('should log the shape of the prompt but not its text', () => {
      const line = formatArgs(['/Users/jane/scenes/mine', params], 'ai.send');

      expect(line).not.toContain('seed');
      expect(line).not.toContain('jane');
      expect(line).not.toContain('Secret Door');
      expect(line).not.toContain('base64');
      expect(line).toContain('"text":"<61 chars>"');
      expect(line).toContain('"attachments":"<1 items>"');
      expect(line).toContain('"apiKeyFromEnv":false');
    });

    it('should hide plain string arguments such as the sign-in code', () => {
      expect(formatArgs(['ABCD-1234'], 'ai.submitSignInCode')).toBe('args[0]="<9 chars>"');
    });

    it('should stop descending into deeply nested objects', () => {
      const line = formatArgs([{ a: { b: { c: { d: 'deep' } } } }], 'ai.mirrorPush');

      expect(line).toBe('args[0]={"a":{"b":{"c":"<object>"}}}');
    });

    it('should hide the arguments of the sharing queue channels too', () => {
      const line = formatArgs(['0x1234567890abcdef1234567890abcdef12345678', 20], 'aiSharing.peek');

      expect(line).not.toContain('0x1234');
      expect(line).toContain('"<42 chars>"');
    });

    it('should leave other channels logged in full', () => {
      expect(formatArgs(['scene-1'], 'workspace.getProject')).toBe('args[0]="scene-1"');
    });
  });

  describe('when a request carries a body', () => {
    it('should keep a sharing upload body out of the log', () => {
      const line = formatArgs(
        [
          {
            baseUrl: 'https://ai-sharing.example.com',
            path: '/turns',
            rawBody: '{"records":[{"prompt":{"text":"my private prompt"}}]}',
          },
        ],
        'metrics.request',
      );

      expect(line).not.toContain('my private prompt');
      expect(line).toContain('/turns');
    });

    it('should keep a structured body out of the log', () => {
      const line = formatArgs(
        [{ path: '/metrics', body: { secret: 'x', note: 'hello' } }],
        'metrics.request',
      );

      expect(line).not.toContain('hello');
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
