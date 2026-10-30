import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAssetImport } from './useAssetImport';

vi.mock('../redux/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => ({ basePath: '', assets: [] }),
}));

const pngFile = () => new File([new Uint8Array([1, 2, 3])], 'thumbnail.png', { type: 'image/png' });

describe('useAssetImport', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when a validateFile option rejects the file', () => {
    it('should open the modal with the asset marked invalid', async () => {
      const validateFile = vi.fn().mockResolvedValue({ type: 'dimensions', message: 'not 16:9' });
      const { result } = renderHook(() => useAssetImport({ multiple: false, validateFile }));

      await act(async () => {
        await result.current.startImport([pngFile()]);
      });

      expect(validateFile).toHaveBeenCalledTimes(1);
      expect(result.current.isModalOpen).toBe(true);
      expect(result.current.areAssetsValid).toBe(false);
      expect(result.current.pendingAssets[0].error).toEqual({
        type: 'dimensions',
        message: 'not 16:9',
      });
    });
  });

  describe('when a validateFile option accepts the file', () => {
    it('should keep the asset valid', async () => {
      const validateFile = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useAssetImport({ multiple: false, validateFile }));

      await act(async () => {
        await result.current.startImport([pngFile()]);
      });

      expect(result.current.isModalOpen).toBe(true);
      expect(result.current.areAssetsValid).toBe(true);
    });
  });

  describe('when the file already failed the built-in checks', () => {
    it('should not run validateFile on it', async () => {
      const validateFile = vi.fn();
      const { result } = renderHook(() => useAssetImport({ multiple: false, validateFile }));

      await act(async () => {
        await result.current.startImport([new File([], 'thumbnail.png.exe')]);
      });

      expect(validateFile).not.toHaveBeenCalled();
      expect(result.current.areAssetsValid).toBe(false);
    });
  });
});
