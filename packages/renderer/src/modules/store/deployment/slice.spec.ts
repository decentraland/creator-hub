import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import { createTestStore } from '../../../../tests/utils/testStore';
import { executeDeploymentWithRetry, initializeDeployment } from './slice';
import { deploy, checkDeploymentStatus } from './utils';

const TEST_PATH = '/test/path';
const TEST_WALLET = '0x123';
const TEST_CHAIN_ID = ChainId.ETHEREUM_MAINNET;
const TEST_PORT = 3000;
const TEST_SCENE_INFO = {
  id: 'test-id',
  name: 'Test Scene',
};

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: vi.fn().mockReturnValue({}),
}));

vi.mock('@dcl/crypto', () => ({
  Authenticator: {
    signPayload: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('/@/modules/store/editor/slice', () => ({
  publishScene: vi.fn().mockImplementation(({ path, target }) => ({
    type: 'editor/publishScene/fulfilled',
    meta: { arg: { path, target } },
    payload: { port: 3000 },
    unwrap: () => Promise.resolve({ port: 3000 }),
  })),
}));

vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils');
  return {
    ...actual,
    deploy: vi.fn(),
    checkDeploymentStatus: vi.fn(),
    fetchFiles: vi.fn().mockResolvedValue([]),
    fetchInfo: vi.fn().mockResolvedValue({
      id: 'test-id',
      name: 'Test Scene',
    }),
  };
});

describe('deployment slice', () => {
  let store: ReturnType<typeof createTestStore>;

  const initDeploymentStore = async () => {
    const store = createTestStore();
    await store
      .dispatch(
        initializeDeployment({
          path: TEST_PATH,
          port: TEST_PORT,
          chainId: TEST_CHAIN_ID,
          wallet: TEST_WALLET,
        }),
      )
      .unwrap();
    return store;
  };

  const mockDeploySuccess = () => {
    vi.mocked(deploy).mockResolvedValue(undefined);
  };

  const mockDeployWithRetryOnce = () => {
    let called = false;
    vi.mocked(deploy).mockImplementation(() => {
      if (!called) {
        called = true;
        throw new Error('Failed');
      }
      return Promise.resolve();
    });
  };

  const mockDeployAlwaysFail = () => {
    vi.mocked(deploy).mockRejectedValue(new Error('Failed'));
  };

  const mockCheckStatus = (status = 'complete') => {
    vi.mocked(checkDeploymentStatus).mockResolvedValue({ status });
  };

  const advanceRetryTimers = async (times = 1, delay = 1000) => {
    for (let i = 0; i < times; i++) {
      await vi.advanceTimersByTimeAsync(delay);
    }
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('executeDeploymentWithRetry', () => {
    describe('when deployment exists', () => {
      beforeEach(async () => {
        store = await initDeploymentStore();
        mockDeploySuccess();
        mockCheckStatus();
      });

      it('should execute deployment successfully', async () => {
        const result = await store.dispatch(executeDeploymentWithRetry(TEST_PATH)).unwrap();
        expect(result).toEqual({
          info: TEST_SCENE_INFO,
          componentsStatus: { status: 'complete' },
        });
      });

      it('should not retry on success', async () => {
        await store.dispatch(executeDeploymentWithRetry(TEST_PATH)).unwrap();
        expect(deploy).toHaveBeenCalledTimes(1);
      });
    });

    describe('when deployment fails and needs retry', () => {
      beforeEach(async () => {
        vi.useFakeTimers();
        store = await initDeploymentStore();
        mockDeployWithRetryOnce();
        mockCheckStatus();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should retry with new server', async () => {
        const resultPromise = store.dispatch(executeDeploymentWithRetry(TEST_PATH));
        await advanceRetryTimers(1);
        const result = await resultPromise.unwrap();

        expect(result).toEqual({
          info: TEST_SCENE_INFO,
          componentsStatus: { status: 'complete' },
        });
        expect(deploy).toHaveBeenCalledTimes(2);
      });

      it('should track deployment attempts', async () => {
        const resultPromise = store.dispatch(executeDeploymentWithRetry(TEST_PATH));
        await advanceRetryTimers(1);
        await resultPromise;
        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.status).toBe('complete');
      });
    });

    describe('when deployment not found', () => {
      beforeEach(() => {
        store = createTestStore(); // not initialized
      });

      it('should reject with appropriate error', async () => {
        const result = await store.dispatch(executeDeploymentWithRetry(TEST_PATH));
        expect(result.type).toBe('deployment/executeWithRetry/rejected');
        expect(result.payload).toEqual({
          message: 'Deployment not found. Initialize it first.',
          info: {},
        });
      });
    });

    describe('when max retries are reached', () => {
      beforeEach(async () => {
        vi.useFakeTimers();
        store = await initDeploymentStore();
        mockDeployAlwaysFail();
        mockCheckStatus();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should fail after max retries', async () => {
        const resultPromise = store.dispatch(executeDeploymentWithRetry(TEST_PATH));
        await advanceRetryTimers(3);
        const result = await resultPromise;

        expect(result.type).toBe('deployment/executeWithRetry/rejected');
        expect(deploy).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      });
    });
  });
});
