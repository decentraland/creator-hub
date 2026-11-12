import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeedbackReport } from '/shared/types/feedback';

type SendResponse = { statusCode?: number };
type AfterSendEvent = (event: { event_id?: string }, response: SendResponse) => void;

const mocks = vi.hoisted(() => {
  const hooks = new Set<AfterSendEvent>();
  return {
    home: '/Users/jane',
    logPath: '',
    online: true,
    response: { statusCode: 200 } as SendResponse | undefined,
    hooks,
    captureFeedback: vi.fn(),
    client: {
      on: vi.fn((_hook: 'afterSendEvent', callback: AfterSendEvent) => {
        hooks.add(callback);
        return () => hooks.delete(callback);
      }),
    } as { on: unknown } | undefined,
  };
});

function emitAfterSend(eventId: string, response: SendResponse) {
  for (const hook of [...mocks.hooks]) hook({ event_id: eventId }, response);
}

vi.mock('os', async importOriginal => {
  const real = await importOriginal<typeof os>();
  const homedir = () => mocks.home;
  return { ...real, homedir, default: { ...real, homedir } };
});

vi.mock('electron', () => ({ net: { isOnline: () => mocks.online } }));

vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    transports: { file: { getFile: () => ({ path: mocks.logPath }) } },
  },
}));

vi.mock('@sentry/electron/main', () => ({
  captureFeedback: mocks.captureFeedback,
  getClient: () => mocks.client,
}));

import { send } from '../src/modules/feedback';

const MB = 1024 * 1024;

const report: FeedbackReport = {
  message: 'Publishing failed twice',
  contact: { method: 'email', value: 'jane.doe@example.com' },
  includeLogs: true,
  associatedEventId: 'deploy-event-id',
  source: 'publish-failure',
};

function attachment() {
  const hint = mocks.captureFeedback.mock.calls[0]?.[1] as
    | { attachments?: { filename: string; data: string }[] }
    | undefined;
  return hint?.attachments?.[0];
}

describe('send', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'feedback-'));
    mocks.logPath = path.join(dir, 'main.log');
    mocks.home = '/Users/jane';
    mocks.online = true;
    mocks.response = { statusCode: 200 };
    mocks.captureFeedback.mockImplementation(() => {
      const response = mocks.response;
      if (response)
        queueMicrotask(() => {
          emitAfterSend('another-event-id', { statusCode: 500 });
          emitAfterSend('feedback-event-id', response);
        });
      return 'feedback-event-id';
    });
    vi.stubEnv('PROD', true);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    mocks.captureFeedback.mockReset();
    mocks.hooks.clear();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('when the report includes the logs', () => {
    describe('and the log is larger than 1 MB', () => {
      beforeEach(() => {
        fs.writeFileSync(mocks.logPath, `FIRST-LINE\n${'x'.repeat(2 * MB)}\nLAST-LINE`);
      });

      it('should attach only the last 1 MB as main.log', async () => {
        await send(report);
        const log = attachment();
        expect(log?.filename).toBe('main.log');
        expect(Buffer.byteLength(log!.data)).toBe(MB);
        expect(log!.data).not.toContain('FIRST-LINE');
        expect(log!.data.endsWith('LAST-LINE')).toBe(true);
      });
    });

    describe('and the log rotated recently, leaving main.log short', () => {
      const oldLog = () => path.join(dir, 'main.old.log');

      beforeEach(() => {
        fs.writeFileSync(oldLog(), `OLD-FIRST\n${'o'.repeat(2 * MB)}\nOLD-LAST\n`);
        fs.writeFileSync(mocks.logPath, 'CURRENT /Users/jane/a');
      });

      it('should fill the 1 MB with the end of main.old.log, old content first', async () => {
        await send(report);
        const log = attachment();
        expect(log?.filename).toBe('main.log');
        expect(mocks.captureFeedback.mock.calls[0][1].attachments).toHaveLength(1);
        expect(Buffer.byteLength(log!.data)).toBe(MB - '/Users/jane'.length + '~'.length);
        expect(log!.data).not.toContain('OLD-FIRST');
        expect(log!.data.endsWith('OLD-LAST\nCURRENT ~/a')).toBe(true);
      });
    });

    describe('and there is no main.old.log', () => {
      beforeEach(() => {
        fs.writeFileSync(mocks.logPath, 'CURRENT ONLY');
      });

      it('should attach main.log alone', async () => {
        await send(report);
        expect(attachment()?.data).toBe('CURRENT ONLY');
      });
    });

    describe('and the log mentions the home directory', () => {
      beforeEach(() => {
        fs.writeFileSync(mocks.logPath, 'open /Users/jane/scenes/a\nread /Users/jane/b');
      });

      it('should replace it with ~', async () => {
        await send(report);
        expect(attachment()?.data).toBe('open ~/scenes/a\nread ~/b');
      });
    });

    describe('and the home directory is a Windows path', () => {
      beforeEach(() => {
        mocks.home = 'C:\\Users\\jane';
        fs.writeFileSync(mocks.logPath, 'open C:\\Users\\jane\\a\nread C:/Users/jane/b');
      });

      it('should replace both slash styles with ~', async () => {
        await send(report);
        expect(attachment()?.data).toBe('open ~\\a\nread ~/b');
      });
    });

    describe.each([
      ['a Windows path', 'C:\\Users\\jane\\AppData\\x', '~\\AppData\\x'],
      [
        'a JSON-escaped Windows path',
        '"C:\\\\Users\\\\jane\\\\AppData\\\\x"',
        '"~\\\\AppData\\\\x"',
      ],
      ['a lowercase forward-slash Windows path', 'c:/users/jane/AppData/x', '~/AppData/x'],
      ['an 8.3 short name', 'C:\\Users\\GABRIE~1\\AppData\\Local\\Temp', '~\\AppData\\Local\\Temp'],
      ['a macOS path of another user', 'open /Users/bob/scenes/a', 'open ~/scenes/a'],
      ['a Linux path', '"path":"/home/jane/scenes/a"', '"path":"~/scenes/a"'],
      ['a Windows name with a space', 'C:\\Users\\Jane Doe\\AppData', '~\\AppData'],
    ])('and the log mentions a user folder as %s', (_, line, expected) => {
      beforeEach(() => {
        fs.writeFileSync(mocks.logPath, line);
      });

      it('should replace the user folder with ~ and keep the rest of the path', async () => {
        await send(report);
        expect(attachment()?.data).toBe(expected);
      });
    });

    describe.each([
      ['a file named users', 'read /var/data/users.json'],
      ['a users folder below the root', 'read /var/data/users/jane/a'],
    ])('and the log mentions %s', (_, line) => {
      beforeEach(() => {
        fs.writeFileSync(mocks.logPath, line);
      });

      it('should leave it untouched', async () => {
        await send(report);
        expect(attachment()?.data).toBe(line);
      });
    });
  });

  describe.each<[string, FeedbackReport]>([
    ['an empty message', { ...report, message: '' }],
    ['a message over 4096 characters', { ...report, message: 'a'.repeat(4097) }],
    [
      'an unknown contact method',
      { ...report, contact: { method: 'phone', value: '+1-555-0100' } as never },
    ],
    [
      'a contact value over 254 characters',
      { ...report, contact: { method: 'email', value: `${'a'.repeat(243)}@example.com` } },
    ],
  ])('when the report has %s', (_, invalid) => {
    beforeEach(() => {
      fs.writeFileSync(mocks.logPath, 'some log');
    });

    it('should reject without sending', async () => {
      await expect(send(invalid)).rejects.toThrow();
      expect(mocks.captureFeedback).not.toHaveBeenCalled();
    });
  });

  describe('when the report is at the limits', () => {
    beforeEach(() => {
      fs.writeFileSync(mocks.logPath, 'some log');
    });

    it('should send it', async () => {
      await send({
        ...report,
        message: 'a'.repeat(4096),
        contact: { method: 'email', value: `${'a'.repeat(242)}@example.com` },
      });
      expect(mocks.captureFeedback).toHaveBeenCalled();
    });
  });

  describe('when the report leaves the logs out', () => {
    beforeEach(() => {
      fs.writeFileSync(mocks.logPath, 'some log');
    });

    it('should send no attachment', async () => {
      await send({ ...report, includeLogs: false });
      expect(attachment()).toBeUndefined();
    });
  });

  describe('when sending a report', () => {
    beforeEach(() => {
      fs.writeFileSync(mocks.logPath, 'some log');
    });

    describe('and the contact is an email', () => {
      it('should pass the message, email, event id, source and contact method to Sentry', async () => {
        await send(report);
        expect(mocks.captureFeedback).toHaveBeenCalledWith(
          {
            message: 'Publishing failed twice',
            email: 'jane.doe@example.com',
            associatedEventId: 'deploy-event-id',
            tags: { source: 'publish-failure', contact_method: 'email' },
          },
          expect.anything(),
        );
      });
    });

    describe('and the contact is a Discord username', () => {
      it('should tag the username and send no email', async () => {
        await send({ ...report, contact: { method: 'discord', value: 'fixture_user' } });
        expect(mocks.captureFeedback).toHaveBeenCalledWith(
          {
            message: 'Publishing failed twice',
            associatedEventId: 'deploy-event-id',
            tags: { source: 'publish-failure', contact_method: 'discord', discord: 'fixture_user' },
          },
          expect.anything(),
        );
      });
    });

    describe('and there is no contact', () => {
      it('should tag only the source', async () => {
        await send({ ...report, contact: undefined });
        expect(mocks.captureFeedback).toHaveBeenCalledWith(
          {
            message: 'Publishing failed twice',
            associatedEventId: 'deploy-event-id',
            tags: { source: 'publish-failure' },
          },
          expect.anything(),
        );
      });
    });
  });

  describe('when Sentry confirms delivery with a 2xx', () => {
    beforeEach(() => {
      mocks.response = { statusCode: 200 };
    });

    it('should resolve to sent', async () => {
      await expect(send({ ...report, includeLogs: false })).resolves.toBe('sent');
    });

    it('should stop listening for deliveries', async () => {
      await send({ ...report, includeLogs: false });
      expect(mocks.hooks.size).toBe(0);
    });
  });

  describe('when Sentry reports no status code', () => {
    beforeEach(() => {
      mocks.response = {};
    });

    describe('and the app is offline, so the transport stored it', () => {
      beforeEach(() => {
        mocks.online = false;
      });

      it('should resolve to queued and stop listening', async () => {
        await expect(send({ ...report, includeLogs: false })).resolves.toBe('queued');
        expect(mocks.hooks.size).toBe(0);
      });
    });

    describe('and the app is online, so it may have been dropped', () => {
      it('should resolve to unknown and stop listening', async () => {
        await expect(send({ ...report, includeLogs: false })).resolves.toBe('unknown');
        expect(mocks.hooks.size).toBe(0);
      });
    });
  });

  describe.each([400, 500])('when Sentry answers with a %i', statusCode => {
    beforeEach(() => {
      mocks.response = { statusCode };
    });

    it('should reject, since nothing was stored to retry', async () => {
      await expect(send({ ...report, includeLogs: false })).rejects.toThrow(String(statusCode));
      expect(mocks.hooks.size).toBe(0);
    });
  });

  describe.each([
    ['offline', false, 'queued'],
    ['online', true, 'unknown'],
  ])('when Sentry does not answer within 30 seconds and the app is %s', (_, online, outcome) => {
    beforeEach(() => {
      mocks.response = undefined;
      mocks.online = online;
      vi.useFakeTimers();
    });

    it(`should resolve to ${outcome} and stop listening`, async () => {
      const delivery = send({ ...report, includeLogs: false });
      let settled = false;
      void delivery.then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(29_999);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(delivery).resolves.toBe(outcome);
      expect(mocks.hooks.size).toBe(0);
    });
  });

  describe('when Sentry is not initialized', () => {
    let client: typeof mocks.client;

    beforeEach(() => {
      client = mocks.client;
      mocks.client = undefined;
    });

    afterEach(() => {
      mocks.client = client;
    });

    it('should reject without sending', async () => {
      await expect(send({ ...report, includeLogs: false })).rejects.toThrow();
      expect(mocks.captureFeedback).not.toHaveBeenCalled();
    });
  });

  describe('when Sentry throws', () => {
    beforeEach(() => {
      fs.writeFileSync(mocks.logPath, 'some log');
      mocks.captureFeedback.mockImplementationOnce(() => {
        throw new Error('transport down');
      });
    });

    it('should reject and stop listening for deliveries', async () => {
      await expect(send(report)).rejects.toThrow('transport down');
      expect(mocks.hooks.size).toBe(0);
    });
  });

  describe('when running a dev build', () => {
    beforeEach(() => {
      vi.stubEnv('PROD', false);
    });

    it('should not send anything and resolve to sent', async () => {
      await expect(send(report)).resolves.toBe('sent');
      expect(mocks.captureFeedback).not.toHaveBeenCalled();
    });
  });
});
