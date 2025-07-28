import type { TestSetup } from '../../utils/testSetup';

/**
 * Scene-related utility functions
 */
export class SceneUtils {
  /**
   * Get a unique scene name for testing
   */
  static getUniqueSceneName(baseName: string = 'E2E test scene'): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return `${baseName}-${timestamp}-${randomId}`;
  }

  /**
   * Wait for scene to be fully loaded in editor
   */
  static async waitForSceneLoad(setup: TestSetup): Promise<void> {
    // Wait for editor to be ready
    await setup.editorPage.waitForPageLoad();

    // Wait for loading to complete
    await setup.editorPage.waitForLoadingToBeVisible();

    // Wait for iframe to be visible
    await setup.editorPage.waitForIframeToBeVisible();
  }

  /**
   * Verify scene is in a valid state for testing
   */
  static async verifySceneState(setup: TestSetup): Promise<void> {
    // Verify editor page is visible
    const isEditorVisible = await setup.editorPage.isVisible();
    if (!isEditorVisible) {
      throw new Error('Editor page is not visible');
    }

    // Verify preview button is visible
    const isPreviewButtonVisible = await setup.editorPage.isPreviewButtonVisible();
    if (!isPreviewButtonVisible) {
      throw new Error('Preview button is not visible');
    }

    // Verify publish button is visible (if applicable)
    const isPublishButtonVisible = await setup.editorPage.isPublishButtonVisible();
    if (!isPublishButtonVisible) {
      throw new Error('Publish button is not visible');
    }
  }

  /**
   * Clean up scene-related test data
   */
  static async cleanupSceneData(setup: TestSetup): Promise<void> {
    try {
      // Clean up any scene-specific data
      await setup.fsHelper.cleanupTestProject(setup.testProjectPath);
    } catch (error) {
      console.warn('Could not clean up scene data:', error);
    }
  }
}
