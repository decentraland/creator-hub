import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editor } from '#preload';

import { createTestStore, type TestStore } from '../../tests/utils/testStore';
import { usePreviewCleanup } from './usePreviewCleanup';

vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

describe('usePreviewCleanup', () => {
  let store: TestStore;
  let killPreviewScene: ReturnType<typeof vi.fn>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store as never}>{children}</Provider>
  );

  beforeEach(() => {
    store = createTestStore();
    killPreviewScene = editor.killPreviewScene as ReturnType<typeof vi.fn>;
    killPreviewScene.mockResolvedValue(undefined);
  });

  afterEach(() => {
    killPreviewScene.mockReset();
  });

  describe('when the editor leaves a project', () => {
    beforeEach(() => {
      const { unmount } = renderHook(() => usePreviewCleanup('/scenes/my-scene'), { wrapper });
      unmount();
    });

    it('should kill the preview of that project', () => {
      expect(killPreviewScene).toHaveBeenCalledWith('/scenes/my-scene', expect.anything());
    });
  });

  describe('when the editor switches to another project', () => {
    beforeEach(() => {
      const { rerender } = renderHook((path: string) => usePreviewCleanup(path), {
        wrapper,
        initialProps: '/scenes/first',
      });
      rerender('/scenes/second');
    });

    it('should kill the preview of the project it left', () => {
      expect(killPreviewScene).toHaveBeenCalledWith('/scenes/first', expect.anything());
    });

    it('should keep the preview of the project it entered', () => {
      expect(killPreviewScene).not.toHaveBeenCalledWith('/scenes/second', expect.anything());
    });
  });

  describe('when no project is loaded yet', () => {
    beforeEach(() => {
      const { unmount } = renderHook(() => usePreviewCleanup(undefined), { wrapper });
      unmount();
    });

    it('should not kill anything', () => {
      expect(killPreviewScene).not.toHaveBeenCalled();
    });
  });
});
