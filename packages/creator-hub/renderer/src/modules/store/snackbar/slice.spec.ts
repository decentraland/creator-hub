import { describe, it, expect, vi } from 'vitest';
import { workspace } from '#preload';

import type { Project } from '/shared/types/projects';

import { createTestStore } from '../../../../tests/utils/testStore';
import { actions as workspaceActions } from '../workspace';

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
});
