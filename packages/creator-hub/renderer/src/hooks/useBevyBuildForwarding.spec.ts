import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BevyRealmBuildEvent } from '/shared/types/ipc';

import type { RPCInfo } from '/@/modules/rpc';

const { editor } = await import('#preload');
const { useBevyBuildForwarding } = await import('./useBevyBuildForwarding');

describe('useBevyBuildForwarding', () => {
  let emit: (event: BevyRealmBuildEvent) => void;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let notifySceneBuild: ReturnType<typeof vi.fn>;
  let iframeRef: { current: RPCInfo | undefined };

  beforeEach(() => {
    unsubscribe = vi.fn();
    vi.mocked(editor.onBevyRealmBuildEvent).mockImplementation(callback => {
      emit = callback;
      return unsubscribe;
    });
    notifySceneBuild = vi.fn().mockResolvedValue(undefined);
    iframeRef = { current: { scene: { notifySceneBuild } } as unknown as RPCInfo };
  });

  describe('when the Bevy renderer is active for a project', () => {
    it('should forward that project’s build events to the inspector without the path', () => {
      renderHook(() => useBevyBuildForwarding(iframeRef, '/scenes/demo'));

      emit({ path: '/scenes/demo', kind: 'rebuild', file: '/scenes/demo/src/index.ts' });
      emit({ path: '/scenes/demo', kind: 'bundle-saved' });

      expect(notifySceneBuild).toHaveBeenNthCalledWith(1, {
        kind: 'rebuild',
        file: '/scenes/demo/src/index.ts',
      });
      expect(notifySceneBuild).toHaveBeenNthCalledWith(2, { kind: 'bundle-saved' });
    });

    it('should ignore events from another project’s realm', () => {
      renderHook(() => useBevyBuildForwarding(iframeRef, '/scenes/demo'));

      emit({ path: '/scenes/other', kind: 'bundle-saved' });

      expect(notifySceneBuild).not.toHaveBeenCalled();
    });

    it('should drop events while the inspector iframe is not connected', () => {
      iframeRef.current = undefined;
      renderHook(() => useBevyBuildForwarding(iframeRef, '/scenes/demo'));

      expect(() => emit({ path: '/scenes/demo', kind: 'bundle-saved' })).not.toThrow();
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useBevyBuildForwarding(iframeRef, '/scenes/demo'));

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('when the Bevy renderer is not active', () => {
    it('should not subscribe at all', () => {
      renderHook(() => useBevyBuildForwarding(iframeRef, undefined));

      expect(editor.onBevyRealmBuildEvent).not.toHaveBeenCalled();
    });
  });
});
