import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeatureFlag } from '/@/modules/store/featureFlags';

import { createTestStore, type TestStore } from '../../tests/utils/testStore';
import { useFeatureFlags } from './useFeatureFlags';

/** The real store module boots the app on import; bind the hooks to the test store. */
vi.mock('#store', async () => {
  const { useDispatch, useSelector } = await import('react-redux');
  return { useDispatch, useSelector };
});

describe('useFeatureFlags', () => {
  let store: TestStore;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store as never}>{children}</Provider>
  );

  /** Puts the flag service's answer into the store, as the startup fetch does. */
  const setFlags = (flags: Record<string, boolean>) =>
    store.dispatch({ type: 'featureFlags/fetch/fulfilled', payload: { flags, variants: {} } });

  beforeEach(() => {
    store = createTestStore();
  });

  describe('when the flag service has not answered yet', () => {
    it('should report the flag as off, so a gated section never flashes', () => {
      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      expect(result.current.isEnabled(FeatureFlag.ANALYTICS)).toBe(false);
    });
  });

  describe('when the service does not know the flag', () => {
    beforeEach(() => {
      setFlags({ 'creatorhub-something-else': true });
    });

    it('should report it as off', () => {
      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      expect(result.current.isEnabled(FeatureFlag.ANALYTICS)).toBe(false);
    });
  });

  describe('when the service turns the flag on', () => {
    beforeEach(() => {
      setFlags({ [FeatureFlag.ANALYTICS]: true });
    });

    it('should report it as on', () => {
      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      expect(result.current.isEnabled(FeatureFlag.ANALYTICS)).toBe(true);
    });
  });

  describe('when the service turns the flag off', () => {
    beforeEach(() => {
      setFlags({ [FeatureFlag.ANALYTICS]: false });
    });

    it('should report it as off', () => {
      const { result } = renderHook(() => useFeatureFlags(), { wrapper });

      expect(result.current.isEnabled(FeatureFlag.ANALYTICS)).toBe(false);
    });
  });
});
