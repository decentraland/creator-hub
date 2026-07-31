import { describe, it, expect, vi } from 'vitest';
import { workspace } from '#preload';

import { createTestStore } from '../../../../tests/utils/testStore';
import { actions as workspaceActions } from '../workspace';

describe('snackbar slice', () => {
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
