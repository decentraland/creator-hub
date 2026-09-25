import { beforeEach, describe, expect, it, vi } from 'vitest';

const on = vi.fn();
const off = vi.fn();
vi.mock('electron', () => ({ ipcRenderer: { on, off } }));

const invoke = vi.fn();
vi.mock('../../src/services/ipc', () => ({ invoke }));

const { attachSceneDebugger } = await import('../../src/modules/editor');

describe('attachSceneDebugger', () => {
  beforeEach(() => {
    on.mockClear();
    off.mockClear();
    invoke.mockReset();
  });

  describe('when there is a backlog from a still-running preview (e.g. after a scene reload)', () => {
    it('should replay it to the callback only after the listener is registered', async () => {
      const backlog = ['line one', 'line two'];
      invoke.mockResolvedValue({ eventName: 'debugger:///scenes/demo', backlog });
      const cb = vi.fn();

      await attachSceneDebugger('/scenes/demo', cb);

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(backlog);
      // The whole point of the fix: subscribe first, then replay — otherwise the backlog
      // races the subscription and is dropped, emptying the console after a reload.
      expect(on.mock.invocationCallOrder[0]).toBeLessThan(cb.mock.invocationCallOrder[0]);
    });
  });

  describe('when the preview has produced no output yet', () => {
    it('should not call the callback with an empty backlog', async () => {
      invoke.mockResolvedValue({ eventName: 'debugger:///scenes/demo', backlog: [] });
      const cb = vi.fn();

      await attachSceneDebugger('/scenes/demo', cb);

      expect(on).toHaveBeenCalledTimes(1);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
