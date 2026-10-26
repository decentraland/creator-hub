import { beforeEach, describe, it, expect, vi } from 'vitest';
import { skills, workspace } from '#preload';

import type { Project } from '/shared/types/projects';
import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';

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

async function setDependencyUpdateStrategy(
  store: ReturnType<typeof createTestStore>,
  dependencyUpdateStrategy: DEPENDENCY_UPDATE_STRATEGY,
) {
  const { settings } = store.getState().workspace;
  await store.dispatch(workspaceActions.updateSettings({ ...settings, dependencyUpdateStrategy }));
}

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

  describe("when the scene's AI skills are behind decentraland/sdk-skills main", () => {
    const isSkillsToast = ($: { type: string }) => $.type === 'new-sdk-skills-version';

    it('should show the "AI skills update" toast', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      const store = createTestStore();

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(store.getState().snackbar.notifications.some(isSkillsToast)).toBe(true);
    });

    it('should dismiss the toast and report success once the update runs', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      vi.mocked(skills.updateProject).mockResolvedValue();
      const store = createTestStore();
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      await store.dispatch(workspaceActions.updateSdkSkills(projectWithOutdatedDeps));

      const { notifications } = store.getState().snackbar;
      expect(skills.updateProject).toHaveBeenCalledWith(projectWithOutdatedDeps.path);
      expect(notifications.some(isSkillsToast)).toBe(false);
      expect(notifications).toContainEqual(
        expect.objectContaining({ severity: 'success', message: 'AI skills were updated' }),
      );
    });
  });

  describe('when "Scene Dependencies" is set to "Do nothing"', () => {
    it('should not check the AI skills or show their toast', async () => {
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.DO_NOTHING);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skills.getProjectStatus).not.toHaveBeenCalled();
      expect(
        store.getState().snackbar.notifications.some($ => $.type === 'new-sdk-skills-version'),
      ).toBe(false);
    });
  });

  describe('when "Scene Dependencies" is set to "Auto-update all my scenes"', () => {
    it('should update outdated AI skills without asking', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      vi.mocked(skills.updateProject).mockResolvedValue();
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      const { notifications } = store.getState().snackbar;
      expect(skills.updateProject).toHaveBeenCalledWith(projectWithOutdatedDeps.path);
      expect(notifications.some($ => $.type === 'new-sdk-skills-version')).toBe(false);
      expect(notifications).toContainEqual(
        expect.objectContaining({ severity: 'success', message: 'AI skills were updated' }),
      );
    });
  });

  describe("when the scene's AI skills are up to date", () => {
    it('should not show the "AI skills update" toast', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: false });
      const store = createTestStore();

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(
        store.getState().snackbar.notifications.some($ => $.type === 'new-sdk-skills-version'),
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
