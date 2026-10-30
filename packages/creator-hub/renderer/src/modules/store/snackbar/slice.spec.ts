import { beforeEach, describe, it, expect, vi } from 'vitest';
import { skills, workspace } from '#preload';

import type { Project } from '/shared/types/projects';
import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';

import { createTestStore } from '../../../../tests/utils/testStore';
import { actions as editorActions } from '../editor';
import { actions as workspaceActions } from '../workspace';
import { actions as deploymentActions } from '../deployment';
import { DeploymentError } from '../../../lib/deploy';
import { actions as snackbarActions } from './slice';

const projectWithOutdatedDeps = {
  path: '/tmp/scene',
  dependencyAvailableUpdates: {
    '@dcl/sdk': { current: '7.0.0', latest: '7.9.9', wanted: '7.9.9', type: 'dependencies' },
  },
} as unknown as Project;

const otherProject = { path: '/projects/other', title: 'Other' } as unknown as Project;

// What runProject does first: from here on this is the scene the creator has open.
function openScene(store: ReturnType<typeof createTestStore>, project: Project) {
  store.dispatch(workspaceActions.runProject.pending('test', project));
}

function skillsToasts(store: ReturnType<typeof createTestStore>) {
  return store.getState().snackbar.notifications.filter($ => $.type === 'sdk-skills');
}

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
    it('should show the "AI skills update" toast', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skillsToasts(store)).toEqual([
        expect.objectContaining({ project: projectWithOutdatedDeps, installed: true }),
      ]);
    });

    it('should dismiss the toast and report success once the update runs', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      vi.mocked(skills.updateProject).mockResolvedValue();
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      await store.dispatch(workspaceActions.updateSdkSkills(projectWithOutdatedDeps));

      const { notifications } = store.getState().snackbar;
      expect(skills.updateProject).toHaveBeenCalledWith(projectWithOutdatedDeps.path);
      expect(skillsToasts(store)).toEqual([]);
      expect(notifications).toContainEqual(
        expect.objectContaining({ severity: 'success', message: 'AI skills are up to date' }),
      );
    });
  });

  describe('when the scene has no AI skills', () => {
    beforeEach(() => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: false, outdated: false });
    });

    it('should offer to install them', async () => {
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skillsToasts(store)).toEqual([expect.objectContaining({ installed: false })]);
    });

    it('should offer again every time the scene opens, even after a dismissal', async () => {
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));
      store.dispatch(snackbarActions.removeSnackbar(skillsToasts(store)[0].id));

      openScene(store, projectWithOutdatedDeps);
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skillsToasts(store)).toEqual([expect.objectContaining({ installed: false })]);
    });

    it('should still ask, not install, under "Auto-update all my scenes"', async () => {
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE);
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skills.updateProject).not.toHaveBeenCalled();
      expect(skillsToasts(store)).toEqual([expect.objectContaining({ installed: false })]);
    });
  });

  describe('when the creator opens another scene before the AI skills check finishes', () => {
    it("should drop the first scene's result instead of showing it on the second", async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      const check = store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));
      openScene(store, otherProject);

      await check;

      expect(skillsToasts(store)).toEqual([]);
    });

    it("should not let the first scene's late result remove the second scene's toast", async () => {
      vi.mocked(skills.getProjectStatus)
        .mockResolvedValueOnce({ installed: true, outdated: true })
        .mockResolvedValueOnce({ installed: true, outdated: true });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      const first = store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));
      openScene(store, otherProject);
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(otherProject));

      await first;

      expect(skillsToasts(store)).toEqual([
        expect.objectContaining({ project: expect.objectContaining({ path: otherProject.path }) }),
      ]);
    });

    it('should drop a result that arrives after the creator went back to the scenes list', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      vi.mocked(skills.updateProject).mockResolvedValue();
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE);
      openScene(store, projectWithOutdatedDeps);
      const check = store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));
      store.dispatch(editorActions.leaveProject());

      await check;

      expect(skills.updateProject).not.toHaveBeenCalled();
      expect(skillsToasts(store)).toEqual([]);
    });

    it('should drop a result for a scene that failed to open', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      const check = store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));
      store.dispatch(
        workspaceActions.runProject.rejected(new Error('boom'), 'test', projectWithOutdatedDeps),
      );

      await check;

      expect(skillsToasts(store)).toEqual([]);
    });

    it("should remove the scene's toast when the creator goes back to the scenes list", async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      store.dispatch(editorActions.leaveProject());

      expect(skillsToasts(store)).toEqual([]);
    });

    it("should remove the first scene's toast as soon as the second starts opening", async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);
      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      openScene(store, otherProject);

      expect(skillsToasts(store)).toEqual([]);
    });
  });

  describe('when "Scene Dependencies" is set to "Do nothing"', () => {
    it('should not check the AI skills or show their toast', async () => {
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.DO_NOTHING);
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skills.getProjectStatus).not.toHaveBeenCalled();
      expect(skillsToasts(store)).toEqual([]);
    });
  });

  describe('when "Scene Dependencies" is set to "Auto-update all my scenes"', () => {
    it('should update outdated AI skills without asking', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      vi.mocked(skills.updateProject).mockResolvedValue();
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE);
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      const { notifications } = store.getState().snackbar;
      expect(skills.updateProject).toHaveBeenCalledWith(projectWithOutdatedDeps.path);
      expect(skillsToasts(store)).toEqual([]);
      expect(notifications).toContainEqual(
        expect.objectContaining({ severity: 'success', message: 'AI skills are up to date' }),
      );
    });

    it('should report the failure when the automatic update fails', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: true });
      vi.mocked(skills.updateProject).mockRejectedValue(new Error('npx exited with code=1'));
      const store = createTestStore();
      await setDependencyUpdateStrategy(store, DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE);
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      const { notifications } = store.getState().snackbar;
      expect(notifications).toContainEqual(
        expect.objectContaining({ severity: 'error', message: 'Could not install the AI skills' }),
      );
      expect(notifications.some($ => $.type === 'generic' && $.severity === 'loading')).toBe(false);
    });
  });

  describe('when two scenes update their AI skills at once', () => {
    it("should keep each scene's progress toast separate", async () => {
      let finishFirst!: () => void;
      vi.mocked(skills.updateProject)
        .mockImplementationOnce(() => new Promise<void>(resolve => (finishFirst = resolve)))
        .mockResolvedValueOnce();
      const store = createTestStore();
      const first = store.dispatch(workspaceActions.updateSdkSkills(projectWithOutdatedDeps));

      await store.dispatch(workspaceActions.updateSdkSkills(otherProject));

      const loading = store
        .getState()
        .snackbar.notifications.filter($ => $.type === 'generic' && $.severity === 'loading');
      expect(loading).toHaveLength(1);
      finishFirst();
      await first;
    });
  });

  describe("when the scene's AI skills are up to date", () => {
    it('should not show the "AI skills update" toast', async () => {
      vi.mocked(skills.getProjectStatus).mockResolvedValue({ installed: true, outdated: false });
      const store = createTestStore();
      openScene(store, projectWithOutdatedDeps);

      await store.dispatch(workspaceActions.checkSdkSkillsUpdate(projectWithOutdatedDeps));

      expect(skillsToasts(store)).toEqual([]);
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
