import { Provider } from 'react-redux';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_SHARING_CONSENT_VERSION, type AiSharingConsent } from '/shared/types/ai-sharing';

import { aiSharing } from '#preload';
import { AuthContext } from '../contexts/AuthContext';
import { actions } from '../modules/store/aiSharing';
import { FeatureFlag } from '../modules/store/featureFlags/types';
import { createTestStore } from '../../tests/utils/testStore';
import { AiSharingUploader } from './useAiSharingUploader';

vi.mock('../lib/aiSharingApi', () => ({ isConfigured: () => true }));

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const consent = (granted: boolean): AiSharingConsent => ({
  consent: granted ? 'granted' : 'denied',
  version: AI_SHARING_CONSENT_VERSION,
  decidedAt: '2026-11-12T00:00:00Z',
  delivered: true,
});

function mount({ wallet, decision }: { wallet?: string; decision?: AiSharingConsent }) {
  const store = createTestStore();
  store.dispatch({
    type: 'featureFlags/fetch/fulfilled',
    payload: { flags: { [FeatureFlag.AI_PROMPT_SHARING]: true }, variants: {} },
  });
  store.dispatch({
    type: 'config/updateSettings/fulfilled',
    meta: { arg: { aiDataSharing: decision ? { [ADDRESS]: decision } : undefined } },
  });
  const flush = vi.spyOn(actions, 'flush').mockReturnValue((() => Promise.resolve()) as never);
  const auth = { wallet, isSignedIn: wallet !== undefined } as never;
  const view = render(
    <Provider store={store}>
      <AuthContext.Provider value={auth}>
        <AiSharingUploader />
      </AuthContext.Provider>
    </Provider>,
  );
  return { flush, view };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('when a signed-in creator shares', () => {
  it('should tell main which wallet is signed in', () => {
    mount({ wallet: ADDRESS, decision: consent(true) });

    expect(aiSharing.setWallet).toHaveBeenCalledWith(ADDRESS);
  });

  it('should upload at start and then every minute', () => {
    const { flush } = mount({ wallet: ADDRESS, decision: consent(true) });
    expect(flush).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(60_000));
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('should stop the timer when it unmounts', () => {
    const { flush, view } = mount({ wallet: ADDRESS, decision: consent(true) });
    view.unmount();

    act(() => vi.advanceTimersByTime(180_000));
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe('when the creator said no', () => {
  it('should keep retrying a withdrawal the service has not received', () => {
    const { flush } = mount({ wallet: ADDRESS, decision: { ...consent(false), delivered: false } });

    act(() => vi.advanceTimersByTime(60_000));
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('should sync once, to deliver the withdrawal, and not keep a timer', () => {
    const { flush } = mount({ wallet: ADDRESS, decision: consent(false) });

    act(() => vi.advanceTimersByTime(180_000));
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe('when signed out', () => {
  it('should tell main nobody is signed in and upload nothing', () => {
    const { flush } = mount({ decision: consent(true) });

    expect(aiSharing.setWallet).toHaveBeenCalledWith(null);
    expect(flush).not.toHaveBeenCalled();
  });
});
