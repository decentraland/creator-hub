import { test } from '@playwright/test';

import { ElectronUtils } from '../../utils/electron';
import { TestSetupHelper } from '../../utils/testSetup';
import { TempDirManager } from '../../utils/tempDirManager';
import { SceneTestHelper, SCENE_NAME } from './helper';

test.describe('when previewing a scene', () => {
  test.setTimeout(120_000);

  test.beforeEach(async () => {
    // Clean up and recreate temp directory before each test
    await TempDirManager.cleanupAndRecreate();
  });

  test.afterEach(async () => {
    // Clean up temp directory after each test
    await TempDirManager.cleanup();
  });

  test('should complete full scene preview flow', async () => {
    const electronUtils = new ElectronUtils();

    try {
      const page = await electronUtils.getPage();
      const setup = await TestSetupHelper.createTestSetup(page);

      // Use the scene helper to create the scene first
      await SceneTestHelper.setupTestSceneWithCreationFlow(setup, SCENE_NAME);

      // Verify preview button is enabled
      await SceneTestHelper.verifyPreviewButtonIsEnabled(setup);

      // Check the debugger option in the preview options
      await setup.editorPage.clickPreviewButtonGroupExtraButton();
      if (!(await setup.editorPage.isPreviewOptionsDebuggerChecked())) {
        await setup.editorPage.checkPreviewOptionsDebugger();
      }

      // Preview the scene (this will either open a new window or show install client modal)
      await setup.editorPage.clickPreviewButton();

      // Verify the preview action was handled (either new window opened or modal shown)
      const app = await electronUtils.getApp();
      await Promise.race([
        app.waitForEvent('window', {
          predicate: page => page.getByTestId('debugger').isVisible({ timeout: 10_000 }),
          timeout: 30_000,
        }),
        setup.editorPage.isInstallClientModalVisible(),
      ]);
    } finally {
      await electronUtils.cleanup();
    }
  });
});
