import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeedbackReport } from '/shared/types/feedback';

const mocks = vi.hoisted(() => ({
  home: '/Users/jane',
  logPath: '',
  captureFeedback: vi.fn(() => 'feedback-event-id'),
}));

vi.mock('os', async importOriginal => {
  const real = await importOriginal<typeof os>();
  const homedir = () => mocks.home;
  return { ...real, homedir, default: { ...real, homedir } };
});

vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    transports: { file: { getFile: () => ({ path: mocks.logPath }) } },
  },
}));

vi.mock('@sentry/electron/main', () => ({ captureFeedback: mocks.captureFeedback }));

import { send } from '../src/modules/feedback';

const MB = 1024 * 1024;

const report: FeedbackReport = {
  message: 'Publishing failed twice',
  email: 'jane.doe@example.com',
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
    vi.stubEnv('PROD', true);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    mocks.captureFeedback.mockClear();
    vi.unstubAllEnvs();
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

    it('should pass the message, email, event id and source to Sentry', async () => {
      await send(report);
      expect(mocks.captureFeedback).toHaveBeenCalledWith(
        {
          message: 'Publishing failed twice',
          email: 'jane.doe@example.com',
          associatedEventId: 'deploy-event-id',
          tags: { source: 'publish-failure' },
        },
        expect.anything(),
      );
    });

    it('should resolve to true', async () => {
      await expect(send(report)).resolves.toBe(true);
    });
  });

  describe('when Sentry throws', () => {
    beforeEach(() => {
      fs.writeFileSync(mocks.logPath, 'some log');
      mocks.captureFeedback.mockImplementationOnce(() => {
        throw new Error('transport down');
      });
    });

    it('should reject', async () => {
      await expect(send(report)).rejects.toThrow('transport down');
    });
  });

  describe('when running a dev build', () => {
    beforeEach(() => {
      vi.stubEnv('PROD', false);
    });

    it('should not send anything and resolve to false', async () => {
      await expect(send(report)).resolves.toBe(false);
      expect(mocks.captureFeedback).not.toHaveBeenCalled();
    });
  });
});
