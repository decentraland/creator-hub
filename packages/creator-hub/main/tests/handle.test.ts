import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('electron', () => ({ ipcMain: { handle: mocks.ipcHandle } }));
vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('@sentry/electron/main', () => ({ captureException: mocks.captureException }));
vi.mock('../src/modules/bin', () => ({ StreamError: class StreamError extends Error {} }));

import { handle } from '../src/modules/handle';

async function invokeFailing(error: Error) {
  handle('bin.install', async () => {
    throw error;
  });
  const listener = mocks.ipcHandle.mock.calls[0][1];
  return listener({});
}

describe('handle', () => {
  beforeEach(() => {
    mocks.ipcHandle.mockReset();
    mocks.captureException.mockReset();
  });

  describe('when the handler rejects with an AbortError', () => {
    it('should return the error to the renderer without reporting it to Sentry', async () => {
      const result = await invokeFailing(new DOMException('aborted', 'AbortError'));
      expect(result).toEqual({ success: false, error: { message: 'aborted', name: 'AbortError' } });
      expect(mocks.captureException).not.toHaveBeenCalled();
    });
  });

  describe('when the handler rejects with any other error', () => {
    it('should return the error to the renderer and report it to Sentry', async () => {
      const result = await invokeFailing(new Error('boom'));
      expect(result).toEqual({ success: false, error: { message: 'boom', name: 'Error' } });
      expect(mocks.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
