import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssetUrl } from './useAssetUrl';

const getFile = vi.fn();
const mocks = vi.hoisted(() => ({ catalog: { assets: [] as { path: string }[] } }));

vi.mock('../redux/data-layer', () => ({
  getDataLayerInterface: () => ({ getFile }),
}));

vi.mock('../redux/hooks', () => ({
  useAppSelector: () => mocks.catalog,
}));

describe('useAssetUrl', () => {
  beforeEach(() => {
    mocks.catalog = { assets: [] };
  });

  describe('when the src is an external url', () => {
    it('should return it unchanged', () => {
      const { result } = renderHook(() => useAssetUrl('https://example.com/tex.png'));
      expect(result.current).toBe('https://example.com/tex.png');
    });
  });

  describe('when the src is a scene file', () => {
    beforeEach(() => {
      getFile.mockResolvedValue({ content: new Uint8Array([1, 2, 3]) });
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:resolved'),
        revokeObjectURL: vi.fn(),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    it('should resolve it to an object url', async () => {
      const { result } = renderHook(() => useAssetUrl('images/tex.png'));
      await waitFor(() => expect(result.current).toBe('blob:resolved'));
    });

    describe('and the src is then cleared', () => {
      it('should clear the resolved url', async () => {
        const { result, rerender } = renderHook(({ src }) => useAssetUrl(src), {
          initialProps: { src: 'images/tex.png' as string | undefined },
        });
        await waitFor(() => expect(result.current).toBe('blob:resolved'));

        rerender({ src: undefined });

        await waitFor(() => expect(result.current).toBeUndefined());
      });
    });

    describe('and the asset is imported after the first attempt', () => {
      it('should re-resolve once it lands in the catalog', async () => {
        getFile.mockReset();
        getFile
          .mockRejectedValueOnce(new Error('not found'))
          .mockResolvedValue({ content: new Uint8Array([1, 2, 3]) });

        const { result, rerender } = renderHook(() => useAssetUrl('images/new.png'));
        await waitFor(() => expect(getFile).toHaveBeenCalledTimes(1));
        expect(result.current).toBeUndefined();

        mocks.catalog = { assets: [{ path: 'images/new.png' }] };
        rerender();

        await waitFor(() => expect(result.current).toBe('blob:resolved'));
      });
    });
  });
});
