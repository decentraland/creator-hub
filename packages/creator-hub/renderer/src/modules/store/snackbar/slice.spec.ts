import { beforeEach, describe, it, expect, vi } from 'vitest';
import { workspace } from '#preload';

import type { Project } from '/shared/types/projects';

import { createTestStore } from '../../../../tests/utils/testStore';
import { actions as workspaceActions } from '../workspace';
import { actions as deploymentActions } from '../deployment';
import { DeploymentError } from '../../../lib/deploy';

const projectWithOutdatedDeps = {
  path: '/tmp/scene',
  dependencyAvailableUpdates: {
    '@dcl/sdk': { current: '7.0.0', latest: '7.9.9', wanted: '7.9.9', type: 'dependencies' },
  },
} as unknown as Project;

describe('snackbar slice', () => {
  describe('when the dependency update is triggered while the "new dependencies version" toast is showing', () => {
    it('should dismiss the "new dependencies version" toast once the update starts (#1474)', async () => {
      const store = createTestStore();

      // Seed the "new dependencies version detected" toast (NOTIFY strategy is the default).
      await store.dispatch(
        workspaceActions.updateAvailableDependencyUpdates({
          project: projectWithOutdatedDeps,
          updates: projectWithOutdatedDeps.dependencyAvailableUpdates,
        }),
      );
      expect(
        store.getState().snackbar.notifications.some($ => $.type === 'new-dependency-version'),
      ).toBe(true);

      await store.dispatch(workspaceActions.updatePackages(projectWithOutdatedDeps));

      expect(
        store.getState().snackbar.notifications.some($ => $.type === 'new-dependency-version'),
      ).toBe(false);
    });
  });

  describe('when importing a project fails because it was already imported', () => {
    it('should show a message clarifying the scene is already imported', async () => {
      vi.mocked(workspace.importProject).mockRejectedValue(
        new Error('PROJECT_ALREADY_IMPORTED: "genesis-plaza" is already on the projects library'),
      );

      const store = createTestStore();
      await store.dispatch(workspaceActions.importProject());

      const { notifications } = store.getState().snackbar;
      const notification = notifications.find($ => $.type === 'generic' && $.severity === 'error');

      expect(notification).toMatchObject({ message: 'Scene already imported' });
    });
  });

  describe('when importing a project fails for any other reason', () => {
    it('should show the generic import failure message', async () => {
      vi.mocked(workspace.importProject).mockRejectedValue(new Error('Something went wrong'));

      const store = createTestStore();
      await store.dispatch(workspaceActions.importProject());

      const { notifications } = store.getState().snackbar;
      const notification = notifications.find($ => $.type === 'generic' && $.severity === 'error');

      expect(notification).toMatchObject({ message: 'Failed importing scene' });
    });
  });

  describe('when a deployment ends', () => {
    const PATH = '/tmp/scene';
    let store: ReturnType<typeof createTestStore>;

    const deployNotifications = () =>
      store.getState().snackbar.notifications.filter($ => $.type === 'deploy');

    const reject = (error: Error) =>
      store.dispatch(deploymentActions.executeDeployment.rejected(error, 'request-1', PATH));

    beforeEach(() => {
      store = createTestStore();
      store.dispatch(deploymentActions.executeDeployment.pending('request-1', PATH));
    });

    describe('and it was cancelled', () => {
      beforeEach(() => {
        reject(
          new DeploymentError('DEPLOYMENT_CANCELLED', { catalyst: 'idle', assetBundle: 'idle' }),
        );
      });

      it('should drop the deploy notification without pushing a new one', () => {
        expect(deployNotifications()).toEqual([]);
      });
    });

    describe('and it failed', () => {
      beforeEach(() => {
        reject(new DeploymentError('DEPLOYMENT_FAILED', { catalyst: 'idle', assetBundle: 'idle' }));
      });

      it('should show the deploy notification', () => {
        expect(deployNotifications()).toHaveLength(1);
      });
    });
  });
});
