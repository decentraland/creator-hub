import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChainId } from '@dcl/schemas';
import { createTestStore } from '../../../../tests/utils/testStore';
import { executeDeployment, initializeDeployment } from './slice';

const TEST_PATH = '/test/path';
const TEST_WALLET = '0x123';
const TEST_CHAIN_ID = ChainId.ETHEREUM_MAINNET;
const TEST_PORT = 3000;
const TEST_SCENE_INFO = {
  id: 'test-id',
  name: 'Test Scene',
  rootCID: 'QmTest123',
  isWorld: false,
};

vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: vi.fn(() => ({
    ephemeralIdentity: { address: '0xtest' },
    expiration: 9999999999999,
    authChain: [],
  })),
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
    getDeploymentUrl: vi.fn((port: number) => `http://localhost:${port}/api`),
    deploy: vi.fn().mockResolvedValue(undefined),
    checkDeploymentStatus: vi.fn(),
    fetchFiles: vi.fn().mockResolvedValue([]),
    fetchInfo: vi.fn().mockResolvedValue({}),
  };
});

import { deploy, checkDeploymentStatus, fetchInfo } from './utils';

describe('deployment slice', () => {
  let store: ReturnType<typeof createTestStore>;
  let mockDate: number;

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

  const mockCheckStatus = (status = 'complete') => {
    vi.mocked(checkDeploymentStatus).mockResolvedValue({ status });
  };

  const advanceRetryTimers = async (times = 1, delay = 1000) => {
    for (let i = 0; i < times; i++) {
      await vi.advanceTimersByTimeAsync(delay);
    }
  };

  beforeEach(() => {
    mockDate = 1000000000000;
    vi.spyOn(Date, 'now').mockReturnValue(mockDate);
    // Reset fetchInfo mock because some tests override it with mockRejectedValue
    // and those overrides persist across tests even after vi.clearAllMocks()
    vi.mocked(fetchInfo).mockResolvedValue(TEST_SCENE_INFO);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('initializeDeployment', () => {
    describe('when initializing a new deployment', () => {
      beforeEach(async () => {
        store = createTestStore();
      });

      it('should create a deployment with a unique id', async () => {
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

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.id).toBeDefined();
        expect(typeof deployment?.id).toBe('string');
      });

      it('should set createdAt timestamp to current time', async () => {
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

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.createdAt).toBe(mockDate);
      });

      it('should set lastUpdated timestamp equal to createdAt', async () => {
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

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.lastUpdated).toBe(deployment?.createdAt);
      });
    });

    describe('when a deployment already exists for the path', () => {
      let firstDeploymentId: string;
      let firstCreatedAt: number;

      beforeEach(async () => {
        vi.useFakeTimers();
        store = await initDeploymentStore();
        const firstDeployment = store.getState().deployment.deployments[TEST_PATH];
        firstDeploymentId = firstDeployment!.id;
        firstCreatedAt = firstDeployment!.createdAt;
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should move the existing deployment to history', async () => {
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

        const history = store.getState().deployment.history[TEST_PATH];
        expect(history).toBeDefined();
        expect(history?.length).toBe(1);
        expect(history?.[0]?.id).toBe(firstDeploymentId);
      });

      it('should create a new deployment with a different id', async () => {
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

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.id).not.toBe(firstDeploymentId);
      });

      it('should set a new createdAt timestamp', async () => {
        const newMockDate = mockDate + 100;
        vi.spyOn(Date, 'now').mockReturnValue(newMockDate);

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

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.createdAt).toBe(newMockDate);
        expect(deployment?.createdAt).toBeGreaterThan(firstCreatedAt);
      });
    });

    describe('when initialization fails', () => {
      beforeEach(() => {
        store = createTestStore();
        vi.mocked(fetchInfo).mockRejectedValue(new Error('Initialization failed'));
      });

      afterEach(() => {
        vi.mocked(fetchInfo).mockReset();
      });

      describe('and no deployment exists', () => {
        it('should create a failed deployment with createdAt', async () => {
          await store
            .dispatch(
              initializeDeployment({
                path: TEST_PATH,
                port: TEST_PORT,
                chainId: TEST_CHAIN_ID,
                wallet: TEST_WALLET,
              }),
            )
            .catch(() => {});

          const deployment = store.getState().deployment.deployments[TEST_PATH];
          expect(deployment?.status).toBe('failed');
          expect(deployment?.createdAt).toBe(mockDate);
        });

        it('should set lastUpdated to current time', async () => {
          await store
            .dispatch(
              initializeDeployment({
                path: TEST_PATH,
                port: TEST_PORT,
                chainId: TEST_CHAIN_ID,
                wallet: TEST_WALLET,
              }),
            )
            .catch(() => {});

          const deployment = store.getState().deployment.deployments[TEST_PATH];
          expect(deployment?.lastUpdated).toBe(mockDate);
        });
      });

      describe('and a deployment already exists', () => {
        let existingCreatedAt: number;

        beforeEach(async () => {
          vi.useFakeTimers();
          vi.mocked(fetchInfo).mockResolvedValueOnce({
            id: 'test-id',
            name: 'Test Scene',
          });
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

          const existingDeployment = store.getState().deployment.deployments[TEST_PATH];
          existingCreatedAt = existingDeployment!.createdAt;

          vi.mocked(fetchInfo).mockRejectedValue(new Error('Initialization failed'));
        });

        afterEach(() => {
          vi.useRealTimers();
          vi.mocked(fetchInfo).mockReset();
        });

        it('should preserve the original createdAt timestamp', async () => {
          const newMockDate = mockDate + 100;
          vi.spyOn(Date, 'now').mockReturnValue(newMockDate);

          await store
            .dispatch(
              initializeDeployment({
                path: TEST_PATH,
                port: TEST_PORT,
                chainId: TEST_CHAIN_ID,
                wallet: TEST_WALLET,
              }),
            )
            .catch(() => {});

          const deployment = store.getState().deployment.deployments[TEST_PATH];
          expect(deployment?.createdAt).toBe(existingCreatedAt);
        });

        it('should update lastUpdated to current time', async () => {
          const newMockDate = mockDate + 100;
          vi.spyOn(Date, 'now').mockReturnValue(newMockDate);

          await store
            .dispatch(
              initializeDeployment({
                path: TEST_PATH,
                port: TEST_PORT,
                chainId: TEST_CHAIN_ID,
                wallet: TEST_WALLET,
              }),
            )
            .catch(() => {});

          const deployment = store.getState().deployment.deployments[TEST_PATH];
          expect(deployment?.lastUpdated).toBe(newMockDate);
          expect(deployment?.lastUpdated).toBeGreaterThan(existingCreatedAt);
        });
      });
    });
  });

  describe('executeDeployment', () => {
    describe('when deployment exists', () => {
      beforeEach(async () => {
        store = await initDeploymentStore();
        mockDeploySuccess();
        mockCheckStatus();
      });

      it('should execute deployment successfully', async () => {
        const result = await store.dispatch(executeDeployment(TEST_PATH)).unwrap();
        expect(result.componentsStatus).toEqual({ status: 'complete' });
        expect(result.info.id).toBe(TEST_SCENE_INFO.id);
        expect(result.info.name).toBe(TEST_SCENE_INFO.name);
      });

      it('should not retry on success', async () => {
        await store.dispatch(executeDeployment(TEST_PATH)).unwrap();
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
        const resultPromise = store.dispatch(executeDeployment(TEST_PATH));
        await advanceRetryTimers(1);
        const result = await resultPromise.unwrap();

        expect(result.componentsStatus).toEqual({ status: 'complete' });
        expect(result.info.id).toBe(TEST_SCENE_INFO.id);
        expect(result.info.name).toBe(TEST_SCENE_INFO.name);
        expect(deploy).toHaveBeenCalledTimes(2);
      });

      it('should track deployment attempts', async () => {
        const resultPromise = store.dispatch(executeDeployment(TEST_PATH));
        await advanceRetryTimers(1);
        await resultPromise;
        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.status).toBe('complete');
      });

      it('should update lastUpdated timestamp on completion', async () => {
        const initialDeployment = store.getState().deployment.deployments[TEST_PATH];
        const initialLastUpdated = initialDeployment!.lastUpdated;
        const newMockDate = mockDate + 1000;

        vi.spyOn(Date, 'now').mockReturnValue(newMockDate);
        const resultPromise = store.dispatch(executeDeployment(TEST_PATH));
        await advanceRetryTimers(1);
        await resultPromise;

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.lastUpdated).toBe(newMockDate);
        expect(deployment?.lastUpdated).toBeGreaterThan(initialLastUpdated);
      });

      it('should preserve createdAt timestamp during execution', async () => {
        const initialDeployment = store.getState().deployment.deployments[TEST_PATH];
        const initialCreatedAt = initialDeployment!.createdAt;

        const resultPromise = store.dispatch(executeDeployment(TEST_PATH));
        await advanceRetryTimers(1);
        await resultPromise;

        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.createdAt).toBe(initialCreatedAt);
      });
    });

    describe('when deployment not found', () => {
      beforeEach(() => {
        store = createTestStore(); // not initialized
      });

      it('should reject with appropriate error', async () => {
        const result = await store.dispatch(executeDeployment(TEST_PATH));
        expect(result.type).toBe('deployment/execute/rejected');
        expect(result.payload.name).toBe('DEPLOYMENT_NOT_FOUND');
      });
    });
  });

  describe('deployment history', () => {
    describe('when multiple deployments are created for the same path', () => {
      let firstDeploymentId: string;
      let secondDeploymentId: string;

      beforeEach(async () => {
        store = createTestStore();

        // First deployment
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
        firstDeploymentId = store.getState().deployment.deployments[TEST_PATH]!.id;

        // Second deployment
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
        secondDeploymentId = store.getState().deployment.deployments[TEST_PATH]!.id;
      });

      it('should keep the latest deployment as active', () => {
        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.id).toBe(secondDeploymentId);
      });

      it('should store the first deployment in history', () => {
        const history = store.getState().deployment.history[TEST_PATH];
        expect(history).toBeDefined();
        expect(history?.length).toBe(1);
        expect(history?.[0]?.id).toBe(firstDeploymentId);
      });

      it('should preserve all properties in history', () => {
        const history = store.getState().deployment.history[TEST_PATH];
        const historicDeployment = history?.[0];

        expect(historicDeployment).toBeDefined();
        expect(historicDeployment?.path).toBe(TEST_PATH);
        expect(historicDeployment?.wallet).toBe(TEST_WALLET);
        expect(historicDeployment?.chainId).toBe(TEST_CHAIN_ID);
        expect(historicDeployment?.createdAt).toBeDefined();
        expect(historicDeployment?.lastUpdated).toBeDefined();
      });
    });

    describe('when three deployments are created for the same path', () => {
      let deploymentIds: string[];

      beforeEach(async () => {
        store = createTestStore();
        deploymentIds = [];

        // Create three deployments with time progression
        for (let i = 0; i < 3; i++) {
          vi.spyOn(Date, 'now').mockReturnValue(mockDate + i * 100);
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
          deploymentIds.push(store.getState().deployment.deployments[TEST_PATH]!.id);
        }
      });

      it('should keep only the latest deployment as active', () => {
        const deployment = store.getState().deployment.deployments[TEST_PATH];
        expect(deployment?.id).toBe(deploymentIds[2]);
      });

      it('should store previous deployments in history', () => {
        const history = store.getState().deployment.history[TEST_PATH];
        expect(history?.length).toBe(2);
        expect(history?.[0]?.id).toBe(deploymentIds[0]);
        expect(history?.[1]?.id).toBe(deploymentIds[1]);
      });

      it('should maintain chronological order in history', () => {
        const history = store.getState().deployment.history[TEST_PATH];
        expect(history?.[0]?.createdAt).toBeLessThan(history![1]!.createdAt);
      });
    });

    describe('when deployments exist for multiple paths', () => {
      const TEST_PATH_2 = '/test/path2';
      let path1DeploymentId: string;
      let path2DeploymentId: string;

      beforeEach(async () => {
        store = createTestStore();

        // Deployment for first path
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
        path1DeploymentId = store.getState().deployment.deployments[TEST_PATH]!.id;

        // Deployment for second path
        await store
          .dispatch(
            initializeDeployment({
              path: TEST_PATH_2,
              port: TEST_PORT,
              chainId: TEST_CHAIN_ID,
              wallet: TEST_WALLET,
            }),
          )
          .unwrap();
        path2DeploymentId = store.getState().deployment.deployments[TEST_PATH_2]!.id;
      });

      it('should maintain separate active deployments', () => {
        const deployment1 = store.getState().deployment.deployments[TEST_PATH];
        const deployment2 = store.getState().deployment.deployments[TEST_PATH_2];

        expect(deployment1?.id).toBe(path1DeploymentId);
        expect(deployment2?.id).toBe(path2DeploymentId);
      });

      it('should maintain separate history arrays', async () => {
        // Create second deployment for first path
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

        const history1 = store.getState().deployment.history[TEST_PATH];
        const history2 = store.getState().deployment.history[TEST_PATH_2];

        expect(history1?.length).toBe(1);
        expect(history2).toBeUndefined();
      });
    });
  });
});
