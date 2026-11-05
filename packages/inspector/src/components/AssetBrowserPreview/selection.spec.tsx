import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssetSelectionProvider, useAssetSelection, useIsAssetSelected } from './selection';
import { formatBytes, formatDuration } from './useAssetPreviewSource';

describe('when selecting assets in the browser', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AssetSelectionProvider>{children}</AssetSelectionProvider>
  );

  describe('and nothing has been selected yet', () => {
    it('should have no selection', () => {
      const { result } = renderHook(() => useAssetSelection(), { wrapper });
      expect(result.current.selection).toBeUndefined();
    });
  });

  describe('and a local asset is selected', () => {
    it('should flag only that asset as selected', () => {
      const { result } = renderHook(
        () => ({
          api: useAssetSelection(),
          local: useIsAssetSelected('local', 'a/model.glb'),
          other: useIsAssetSelected('local', 'b/other.glb'),
          sameIdOtherSource: useIsAssetSelected('catalog', 'a/model.glb'),
        }),
        { wrapper },
      );
      act(() =>
        result.current.api.select({
          source: 'local',
          id: 'a/model.glb',
          name: 'model.glb',
          path: 'a/model.glb',
        }),
      );
      expect(result.current.local).toBe(true);
      expect(result.current.other).toBe(false);
      expect(result.current.sameIdOtherSource).toBe(false);
    });

    it('should clear when the selection is reset', () => {
      const { result } = renderHook(() => useAssetSelection(), { wrapper });
      act(() => result.current.select({ source: 'local', id: 'x', name: 'x', path: 'x' }));
      act(() => result.current.select(undefined));
      expect(result.current.selection).toBeUndefined();
    });
  });
});

describe('when formatting file sizes', () => {
  it('should show bytes, kilobytes and megabytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('should show a dash when the size is unknown', () => {
    expect(formatBytes(undefined)).toBe('-');
  });
});

describe('when formatting durations', () => {
  it('should show seconds under a minute and minutes above', () => {
    expect(formatDuration(4.04)).toBe('4.0 s');
    expect(formatDuration(125)).toBe('2:05 min');
  });

  it('should show a dash when the duration is unknown', () => {
    expect(formatDuration(undefined)).toBe('-');
    expect(formatDuration(Infinity)).toBe('-');
  });
});
