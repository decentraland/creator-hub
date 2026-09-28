import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectAssetsChangedEvent } from '/shared/types/ipc';

import type { RPCInfo } from '/@/modules/rpc';

const { editor } = await import('#preload');
const { useProjectAssetWatch } = await import('./useProjectAssetWatch');

describe('useProjectAssetWatch', () => {
  let emit: (event: ProjectAssetsChangedEvent) => void;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let notifyAssetsChanged: ReturnType<typeof vi.fn>;
  let iframeRef: { current: RPCInfo | undefined };

  beforeEach(() => {
    unsubscribe = vi.fn();
    vi.mocked(editor.startProjectWatcher).mockResolvedValue(undefined);
    vi.mocked(editor.stopProjectWatcher).mockResolvedValue(undefined);
    vi.mocked(editor.onProjectAssetsChanged).mockImplementation(callback => {
      emit = callback;
      return unsubscribe;
    });
    notifyAssetsChanged = vi.fn().mockResolvedValue(undefined);
    iframeRef = { current: { scene: { notifyAssetsChanged } } as unknown as RPCInfo };
  });

  describe('when a project is open', () => {
    it('should start the filesystem watcher for the project path', () => {
      renderHook(() => useProjectAssetWatch(iframeRef, '/scenes/demo'));

      expect(editor.startProjectWatcher).toHaveBeenCalledWith('/scenes/demo');
    });

    it('should tell the inspector to re-fetch its catalog on a change for that project', () => {
      renderHook(() => useProjectAssetWatch(iframeRef, '/scenes/demo'));

      emit({ path: '/scenes/demo' });

      expect(notifyAssetsChanged).toHaveBeenCalledTimes(1);
    });

    it('should ignore changes from another watched project', () => {
      renderHook(() => useProjectAssetWatch(iframeRef, '/scenes/demo'));

      emit({ path: '/scenes/other' });

      expect(notifyAssetsChanged).not.toHaveBeenCalled();
    });

    it('should drop changes while the inspector iframe is not connected', () => {
      iframeRef.current = undefined;
      renderHook(() => useProjectAssetWatch(iframeRef, '/scenes/demo'));

      expect(() => emit({ path: '/scenes/demo' })).not.toThrow();
    });

    it('should stop the watcher and unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useProjectAssetWatch(iframeRef, '/scenes/demo'));

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
      expect(editor.stopProjectWatcher).toHaveBeenCalledWith('/scenes/demo');
    });
  });

  describe('when no project is open', () => {
    it('should not start a watcher or subscribe', () => {
      renderHook(() => useProjectAssetWatch(iframeRef, undefined));

      expect(editor.startProjectWatcher).not.toHaveBeenCalled();
      expect(editor.onProjectAssetsChanged).not.toHaveBeenCalled();
    });
  });
});
