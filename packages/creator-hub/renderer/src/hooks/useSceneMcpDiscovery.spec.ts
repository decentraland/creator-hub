import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ai } = await import('#preload');
const { useSceneMcpDiscovery } = await import('./useSceneMcpDiscovery');

describe('useSceneMcpDiscovery', () => {
  beforeEach(() => {
    vi.mocked(ai.sceneOpened).mockResolvedValue(undefined);
    vi.mocked(ai.sceneClosed).mockResolvedValue(undefined);
  });

  describe('when a project is open', () => {
    it('should report the open scene to main', () => {
      renderHook(() => useSceneMcpDiscovery('/scenes/demo'));

      expect(ai.sceneOpened).toHaveBeenCalledWith('/scenes/demo');
      expect(ai.sceneClosed).not.toHaveBeenCalled();
    });

    it('should report the scene as closed on unmount', () => {
      const { unmount } = renderHook(() => useSceneMcpDiscovery('/scenes/demo'));

      unmount();

      expect(ai.sceneClosed).toHaveBeenCalledWith('/scenes/demo');
    });

    it('should close the previous scene and open the new one when the path changes', () => {
      const { rerender } = renderHook(({ path }) => useSceneMcpDiscovery(path), {
        initialProps: { path: '/scenes/demo' as string | undefined },
      });

      rerender({ path: '/scenes/other' });

      expect(ai.sceneClosed).toHaveBeenCalledWith('/scenes/demo');
      expect(ai.sceneOpened).toHaveBeenLastCalledWith('/scenes/other');
    });

    it('should swallow a failed report instead of surfacing it', () => {
      vi.mocked(ai.sceneOpened).mockRejectedValue(new Error('ipc down'));

      expect(() => renderHook(() => useSceneMcpDiscovery('/scenes/demo'))).not.toThrow();
    });
  });

  describe('when no project is open', () => {
    it('should report nothing', () => {
      renderHook(() => useSceneMcpDiscovery(undefined));

      expect(ai.sceneOpened).not.toHaveBeenCalled();
    });
  });
});
