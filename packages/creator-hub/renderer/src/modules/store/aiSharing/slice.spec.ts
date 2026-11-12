import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_SHARING_CONSENT_VERSION, type AiTurnRecord } from '/shared/types/ai-sharing';
import type { AppSettings } from '/shared/types/settings';

import { ai, aiSharing } from '#preload';
import * as api from '../../../lib/aiSharingApi';
import { AuthServerProvider } from '../../../lib/auth';
import { createTestStore, type TestStore } from '../../../../tests/utils/testStore';
import { actions as aiActions } from '../ai';
import { FeatureFlag } from '../featureFlags/types';
import { actions, selectSharingView, shouldShareTurn } from './slice';

vi.mock('../../../lib/aiSharingApi', () => ({
  isConfigured: vi.fn(() => true),
  MAX_RECORDS_PER_UPLOAD: 20,
  getConsent: vi.fn(),
  putConsent: vi.fn(),
  uploadTurns: vi.fn(),
  deleteAllTurns: vi.fn(),
}));
vi.mock('../../../lib/auth', () => ({ AuthServerProvider: { getAccount: vi.fn() } }));

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const ok = <T>(data: T, status = 200) => ({ ok: true as const, status, data });
const fail = (status: number) => ({ ok: false as const, status, error: 'nope' });
const granted = {
  consent: 'granted' as const,
  version: AI_SHARING_CONSENT_VERSION,
  decidedAt: '2026-11-12T00:00:00Z',
};
const record = (id: string) => ({ recordId: id, address: ADDRESS }) as AiTurnRecord;

function setup({
  flag = true,
  consent,
  messages = [],
}: {
  flag?: boolean;
  consent?: AppSettings['aiDataSharing'];
  messages?: Array<{ role: 'user' | 'assistant'; done: boolean; error?: string }>;
} = {}): TestStore {
  const store = createTestStore();
  store.dispatch({
    type: 'featureFlags/fetch/fulfilled',
    payload: { flags: { [FeatureFlag.AI_PROMPT_SHARING]: flag }, variants: {} },
  });
  store.dispatch({
    type: 'config/updateSettings/fulfilled',
    meta: { arg: { aiAssistant: true, aiDataSharing: consent } },
  });
  store.dispatch(
    aiActions.setSessionState({
      sessions: [{ id: 's1', title: 'chat', updatedAt: 1 }],
      currentSessionId: 's1',
      messages: messages.map((m, i) => ({ id: `m${i}`, parts: [], ...m })),
    }),
  );
  return store;
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  vi.mocked(AuthServerProvider.getAccount).mockReturnValue(ADDRESS);
  vi.mocked(api.isConfigured).mockReturnValue(true);
  vi.mocked(aiSharing.peek).mockResolvedValue([]);
  vi.mocked(aiSharing.list).mockResolvedValue([]);
});

describe('when deciding what the chat shows', () => {
  const replied = [{ role: 'assistant' as const, done: true }];

  it('should show nothing while the feature flag is off', () => {
    const store = setup({ flag: false, messages: replied });

    expect(selectSharingView(store.getState(), true).status).toBe('hidden');
  });

  it('should show nothing when the service is not configured', () => {
    vi.mocked(api.isConfigured).mockReturnValue(false);
    const store = setup({ messages: replied });

    expect(selectSharingView(store.getState(), true).status).toBe('hidden');
  });

  it('should wait for a first finished reply before asking', () => {
    const store = setup({ messages: [{ role: 'user', done: true }] });

    expect(selectSharingView(store.getState(), true).status).toBe('hidden');
  });

  it('should ask a signed-in creator who was never asked', () => {
    const store = setup({ messages: replied });

    expect(selectSharingView(store.getState(), true).status).toBe('ask');
  });

  it('should tell a signed-out creator to sign in instead', () => {
    const store = setup({ messages: replied });

    expect(selectSharingView(store.getState(), false).status).toBe('signin');
  });

  it('should stop asking after "not now" for this run', () => {
    const store = setup({ messages: replied });
    store.dispatch(actions.notNow());

    expect(selectSharingView(store.getState(), true).status).toBe('hidden');
  });

  it('should never ask again someone who said no', () => {
    const store = setup({ messages: replied, consent: { ...granted, consent: 'denied' } });

    expect(selectSharingView(store.getState(), true).status).toBe('hidden');
  });

  it('should ask again someone who said yes to an older version of the text', () => {
    const store = setup({ messages: replied, consent: { ...granted, version: 0 } });

    expect(selectSharingView(store.getState(), true).status).toBe('ask');
  });

  it('should show the chip while sharing, with the conversation exclusion', async () => {
    const store = setup({ messages: replied, consent: granted });
    await store.dispatch(aiActions.setConversationShared(false));

    expect(selectSharingView(store.getState(), true)).toEqual({
      status: 'on',
      conversationExcluded: true,
    });
  });
});

describe('when a turn is sent', () => {
  it('should share it only with current consent, signed in, and not excluded', async () => {
    const store = setup({ consent: granted });
    expect(shouldShareTurn(store.getState())).toBe(true);

    await store.dispatch(aiActions.setConversationShared(false));
    expect(shouldShareTurn(store.getState())).toBe(false);
  });

  it('should not share it when signed out', () => {
    vi.mocked(AuthServerProvider.getAccount).mockReturnValue(undefined as never);
    const store = setup({ consent: granted });

    expect(shouldShareTurn(store.getState())).toBe(false);
  });

  it('should not share it without consent', () => {
    expect(shouldShareTurn(setup().getState())).toBe(false);
  });
});

describe('when the chat sends a turn', () => {
  const sendIn = async (store: TestStore) => {
    store.dispatch({
      type: 'workspace/runProject/fulfilled',
      payload: { path: '/scene', title: 's' },
    });
    vi.mocked(ai.isBusy).mockResolvedValue(false);
    await store.dispatch(aiActions.send({ text: 'add a door' }));
    return vi.mocked(ai.send).mock.calls[0][1];
  };

  it('should ask main to share it, with counts only', async () => {
    const params = await sendIn(setup({ consent: granted }));

    expect(params.share).toEqual({ turnIndex: 0, selectedEntityCount: 0, mentionedAssetCount: 0 });
  });

  it('should not ask main to share it without consent', async () => {
    const params = await sendIn(setup());

    expect(params.share).toBeUndefined();
  });
});

describe('when the creator decides', () => {
  it('should save a yes and tell the server', async () => {
    vi.mocked(api.putConsent).mockResolvedValue(ok({ granted: true, version: 1 }));
    const store = setup();

    await store.dispatch(actions.decide(true));

    expect(store.getState().workspace.settings.aiDataSharing).toMatchObject({
      consent: 'granted',
      version: AI_SHARING_CONSENT_VERSION,
    });
    expect(api.putConsent).toHaveBeenCalledWith(true, AI_SHARING_CONSENT_VERSION);
    expect(store.getState().aiSharing.serverConsentSynced).toBe(true);
  });

  it('should empty the local queue on a no', async () => {
    vi.mocked(api.putConsent).mockResolvedValue(ok({ granted: false, version: 1 }));
    const store = setup({ consent: granted });

    await store.dispatch(actions.decide(false));

    expect(aiSharing.purge).toHaveBeenCalled();
    expect(store.getState().workspace.settings.aiDataSharing?.consent).toBe('denied');
  });

  it('should keep the local answer when the server cannot be reached', async () => {
    vi.mocked(api.putConsent).mockResolvedValue(fail(0));
    const store = setup();

    await store.dispatch(actions.decide(true));

    expect(store.getState().workspace.settings.aiDataSharing?.consent).toBe('granted');
    expect(store.getState().aiSharing.serverConsentSynced).toBe(false);
  });
});

describe('when uploading', () => {
  beforeEach(() => {
    vi.mocked(api.putConsent).mockResolvedValue(ok({ granted: true, version: 1 }));
  });

  it('should confirm consent with the server, then upload and acknowledge each batch', async () => {
    vi.mocked(aiSharing.peek)
      .mockResolvedValueOnce([record('a'), record('b')])
      .mockResolvedValueOnce([]);
    vi.mocked(api.uploadTurns).mockResolvedValue(ok({ accepted: 2 }));
    const store = setup({ consent: granted });

    await store.dispatch(actions.flush());

    expect(api.putConsent).toHaveBeenCalledWith(true, AI_SHARING_CONSENT_VERSION);
    expect(aiSharing.peek).toHaveBeenCalledWith(ADDRESS, 20);
    expect(aiSharing.ack).toHaveBeenCalledWith(['a', 'b']);
  });

  it('should upload nothing without consent', async () => {
    const store = setup();

    await store.dispatch(actions.flush());

    expect(aiSharing.peek).not.toHaveBeenCalled();
    expect(api.uploadTurns).not.toHaveBeenCalled();
  });

  it('should upload nothing while the flag is off', async () => {
    const store = setup({ flag: false, consent: granted });

    await store.dispatch(actions.flush());

    expect(api.uploadTurns).not.toHaveBeenCalled();
  });

  it('should keep the batch and back off when the service is down', async () => {
    vi.mocked(aiSharing.peek).mockResolvedValue([record('a')]);
    vi.mocked(api.uploadTurns).mockResolvedValue(fail(503));
    const store = setup({ consent: granted });

    await store.dispatch(actions.flush());

    expect(aiSharing.ack).not.toHaveBeenCalled();
    expect(store.getState().aiSharing.nextUploadAt).toBeGreaterThan(Date.now());

    await store.dispatch(actions.flush());
    expect(api.uploadTurns).toHaveBeenCalledTimes(1);
  });

  it('should drop a batch the service rejects as invalid, so it cannot block the queue', async () => {
    vi.mocked(aiSharing.peek)
      .mockResolvedValueOnce([record('bad')])
      .mockResolvedValueOnce([]);
    vi.mocked(api.uploadTurns).mockResolvedValue(fail(400));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = setup({ consent: granted });

    await store.dispatch(actions.flush());

    expect(aiSharing.ack).toHaveBeenCalledWith(['bad']);
  });

  it('should stop, empty the queue and ask again when the server has no consent', async () => {
    vi.mocked(aiSharing.peek).mockResolvedValue([record('a')]);
    vi.mocked(api.uploadTurns).mockResolvedValue(fail(403));
    const store = setup({ consent: granted });

    await store.dispatch(actions.flush());

    expect(aiSharing.purge).toHaveBeenCalled();
    expect(store.getState().workspace.settings.aiDataSharing).toBeUndefined();
  });

  it('should not run two uploads at once', async () => {
    let release: () => void = () => {};
    vi.mocked(aiSharing.peek)
      .mockReturnValueOnce(new Promise(r => (release = () => r([])) as never))
      .mockResolvedValue([]);
    const store = setup({ consent: granted });

    const first = store.dispatch(actions.flush());
    await settled();
    await store.dispatch(actions.flush());
    release();
    await first;

    expect(aiSharing.peek).toHaveBeenCalledTimes(1);
  });
});

describe('when deleting everything shared', () => {
  it('should delete on the server, empty the queue and turn sharing off', async () => {
    vi.mocked(api.deleteAllTurns).mockResolvedValue(ok({ deleted: 7 }));
    vi.mocked(api.putConsent).mockResolvedValue(ok({ granted: false, version: 1 }));
    const store = setup({ consent: granted });

    await store.dispatch(actions.deleteEverything());

    expect(aiSharing.purge).toHaveBeenCalled();
    expect(store.getState().aiSharing).toMatchObject({ deleteStatus: 'deleted', deletedCount: 7 });
    expect(store.getState().workspace.settings.aiDataSharing?.consent).toBe('denied');
  });

  it('should keep sharing on and say so when the server delete fails', async () => {
    vi.mocked(api.deleteAllTurns).mockResolvedValue(fail(500));
    const store = setup({ consent: granted });

    await store.dispatch(actions.deleteEverything());

    expect(aiSharing.purge).not.toHaveBeenCalled();
    expect(store.getState().aiSharing.deleteStatus).toBe('failed');
    expect(store.getState().workspace.settings.aiDataSharing?.consent).toBe('granted');
  });
});
