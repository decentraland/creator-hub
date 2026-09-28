import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RPCInfo } from '/@/modules/rpc';

const { editor } = await import('#preload');
const { useDebugLogForwarding } = await import('./useDebugLogForwarding');

type Props = { nonce: number };

// The debugger attachment resolves over several microtasks; a macrotask hop settles it.
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function makeScene() {
  return {
    setDebugConsoleEnabled: vi.fn().mockResolvedValue(undefined),
    setConsoleDetached: vi.fn().mockResolvedValue(undefined),
    pushDebugLogs: vi.fn().mockResolvedValue(undefined),
  };
}

describe('useDebugLogForwarding', () => {
  let iframeRef: { current: RPCInfo | undefined };
  let firstScene: ReturnType<typeof makeScene>;
  let cleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanup = vi.fn();
    vi.mocked(editor.attachSceneDebugger).mockResolvedValue({ cleanup } as never);
    firstScene = makeScene();
    iframeRef = { current: { scene: firstScene } as unknown as RPCInfo };
  });

  describe('when the inspector iframe is reloaded while a preview is running', () => {
    it('should re-attach the debugger and enable the console on the fresh inspector', async () => {
      const { rerender } = renderHook(
        ({ nonce }: Props) =>
          useDebugLogForwarding(iframeRef, true, true, '/scenes/demo', false, nonce),
        { initialProps: { nonce: 1 } },
      );
      await flush();
      expect(firstScene.setDebugConsoleEnabled).toHaveBeenCalledWith(true);
      expect(editor.attachSceneDebugger).toHaveBeenCalledTimes(1);

      const secondScene = makeScene();
      iframeRef.current = { scene: secondScene } as unknown as RPCInfo;
      rerender({ nonce: 2 });
      await flush();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(editor.attachSceneDebugger).toHaveBeenCalledTimes(2);
      expect(secondScene.setDebugConsoleEnabled).toHaveBeenCalledWith(true);
      expect(secondScene.setConsoleDetached).toHaveBeenCalledWith(false);
    });
  });

  describe('when nothing about the inspector changed', () => {
    it('should keep the existing debugger attachment', async () => {
      const { rerender } = renderHook(
        ({ nonce }: Props) =>
          useDebugLogForwarding(iframeRef, true, true, '/scenes/demo', false, nonce),
        { initialProps: { nonce: 1 } },
      );
      await flush();

      rerender({ nonce: 1 });
      await flush();

      expect(cleanup).not.toHaveBeenCalled();
      expect(editor.attachSceneDebugger).toHaveBeenCalledTimes(1);
    });
  });
});
