import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewOptions } from '/shared/types/settings';

import { editor } from '#preload';

import { createTestStore } from '../../../../tests/utils/testStore';
import type * as DeployApi from '../deployment/deploy-api';
import { registerDeployServer } from '../deployment/deploy-api';
import { publishScene, runScene } from './slice';

vi.mock('../deployment/deploy-api', async importOriginal => {
  const actual = await importOriginal<typeof DeployApi>();
  return { ...actual, registerDeployServer: vi.fn(actual.registerDeployServer) };
});

vi.mock('../deployment/utils', async importOriginal => ({
  ...((await importOriginal()) as object),
  fetchInfo: vi.fn(async () => ({ isWorld: false, rootCID: 'bafy' })),
  fetchFiles: vi.fn(async () => []),
}));

const TEST_PATH = '/test/scene';
const PREVIEW_OPTS: PreviewOptions = {
  debugger: false,
  skipAuthScreen: true,
  enableLandscapeTerrains: false,
  openNewInstance: false,
  multiInstance: false,
  showWarnings: false,
  loadRawGltfs: false,
};

describe('editor slice preview state', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('when running a scene that opens normally', () => {
    beforeEach(() => {
      vi.mocked(editor.runScene).mockResolvedValue(undefined as never);
    });

    it('should mark the preview as running once the run settles', async () => {
      const promise = store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      expect(store.getState().editor.loadingPreview).toBe(true);

      await promise;

      expect(store.getState().editor.loadingPreview).toBe(false);
      expect(store.getState().editor.isPreviewRunning).toBe(true);
    });
  });

  describe('when the run fails', () => {
    beforeEach(() => {
      vi.mocked(editor.runScene).mockRejectedValue(new Error('boom'));
    });

    it('should clear the loading state without marking the preview as running', async () => {
      await store.dispatch(runScene({ path: TEST_PATH, ...PREVIEW_OPTS }));

      expect(store.getState().editor.loadingPreview).toBe(false);
      expect(store.getState().editor.isPreviewRunning).toBe(false);
    });
  });
});

describe('editor slice publish', () => {
  let store: ReturnType<typeof createTestStore>;

  const publish = () =>
    store.dispatch(publishScene({ path: TEST_PATH, chainId: 1, wallet: '0xabc' })).unwrap();

  beforeEach(() => {
    store = createTestStore();
    vi.mocked(registerDeployServer).mockClear();
  });

  describe('when the CLI hands out a deploy token', () => {
    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: true,
        deployToken: 'token-example-123',
      });
      await publish();
    });

    it('should hand the CLI and its token to the cancel requests', () => {
      expect(registerDeployServer).toHaveBeenCalledWith({
        port: 4100,
        supportsDeployResource: true,
        deployToken: 'token-example-123',
      });
    });

    it('should flag the deployment as supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(true);
    });

    it('should flag the deployment as holding its cancel token', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.hasCancelToken).toBe(true);
    });

    it('should keep the token out of the store', () => {
      expect(JSON.stringify(store.getState())).not.toContain('token-example-123');
    });
  });

  describe('when the CLI serves the deploy resource but takes no deploy token', () => {
    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: true,
      });
      await publish();
    });

    it('should flag the deployment as supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(true);
    });

    it('should flag the deployment as holding no cancel token', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.hasCancelToken).toBe(false);
    });
  });

  describe('when the CLI predates the deploy resource', () => {
    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: false,
      });
      await publish();
    });

    it('should hand the CLI over without a token, dropping any earlier one', () => {
      expect(registerDeployServer).toHaveBeenCalledWith({
        port: 4100,
        supportsDeployResource: false,
      });
    });

    it('should flag the deployment as not supporting the deploy resource', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.supportsDeployResource).toBe(
        false,
      );
    });
  });

  describe('when the user publishes again over an earlier deployment', () => {
    let replacedWhenMainStarts: boolean | undefined;

    beforeEach(async () => {
      vi.mocked(editor.publishScene).mockResolvedValue({
        port: 4100,
        supportsDeployResource: true,
      });
      await publish();
      vi.mocked(editor.publishScene).mockImplementation(async () => {
        replacedWhenMainStarts = store.getState().deployment.deployments[TEST_PATH]?.replaced;
        return { port: 4101, supportsDeployResource: true };
      });
      await publish();
    });

    it('should mark the earlier deployment as replaced before main starts the new CLI', () => {
      expect(replacedWhenMainStarts).toBe(true);
    });

    it('should start the new deployment unmarked', () => {
      expect(store.getState().deployment.deployments[TEST_PATH]?.replaced).toBeUndefined();
    });
  });
});
