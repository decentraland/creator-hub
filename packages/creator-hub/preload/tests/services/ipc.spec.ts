import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcRenderer } from 'electron';
import type { IpcResult, IpcError } from '../../../shared/types/ipc';

import { invoke } from '../../src/services/ipc';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
  },
}));

describe('ipc service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('invoke', () => {
    const mockChannel = 'config.getConfig';
    const mockArgs = ['arg1', 'arg2'];

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('when the IPC call succeeds', () => {
      let mockResult: IpcResult<string>;

      beforeEach(() => {
        mockResult = {
          success: true,
          value: 'test value',
        };

        vi.mocked(ipcRenderer.invoke).mockResolvedValue(mockResult);
      });

      it('should call ipcRenderer.invoke with channel and args', async () => {
        await invoke(mockChannel as any, ...mockArgs);

        expect(ipcRenderer.invoke).toHaveBeenCalledWith(mockChannel, ...mockArgs);
      });

      it('should return the value from successful result', async () => {
        const result = await invoke(mockChannel as any, ...mockArgs);

        expect(result).toBe('test value');
      });
    });

    describe('when the IPC call fails', () => {
      let mockError: IpcError;

      beforeEach(() => {
        mockError = {
          success: false,
          error: {
            name: 'TestError',
            message: 'Test error message',
          },
        };

        vi.mocked(ipcRenderer.invoke).mockResolvedValue(mockError);
      });

      it('should throw an error with the correct message', async () => {
        await expect(invoke(mockChannel as any, ...mockArgs)).rejects.toThrow('Test error message');
      });

      it('should throw an error with the correct name', async () => {
        try {
          await invoke(mockChannel as any, ...mockArgs);
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.name).toBe('TestError');
        }
      });
    });

    describe('when called with no arguments', () => {
      beforeEach(() => {
        vi.mocked(ipcRenderer.invoke).mockResolvedValue({
          success: true,
          value: 'result',
        });
      });

      it('should call ipcRenderer.invoke with only the channel', async () => {
        await invoke(mockChannel as any);

        expect(ipcRenderer.invoke).toHaveBeenCalledWith(mockChannel);
      });
    });

    describe('when called with multiple arguments', () => {
      const multipleArgs = ['arg1', 'arg2', 'arg3', { key: 'value' }];

      beforeEach(() => {
        vi.mocked(ipcRenderer.invoke).mockResolvedValue({
          success: true,
          value: 'result',
        });
      });

      it('should pass all arguments to ipcRenderer.invoke', async () => {
        await invoke(mockChannel as any, ...multipleArgs);

        expect(ipcRenderer.invoke).toHaveBeenCalledWith(mockChannel, ...multipleArgs);
      });
    });
  });
});
