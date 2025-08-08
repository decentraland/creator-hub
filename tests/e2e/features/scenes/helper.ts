import { expect } from '@playwright/test';
import type { TestSetup } from '../../utils/testSetup';
import { getTestScenesDir } from '../../config/testConfig';

export const SCENE_NAME = process.env.E2E_SCENE_NAME || 'E2E test scene';

export class SceneTestHelper {
  /**
   * Complete scene creation flow from home to editor
   * This encapsulates the entire scene creation process
   */
  static async setupTestSceneWithCreationFlow(
    setup: TestSetup,
    sceneName: string = SCENE_NAME,
  ): Promise<void> {
    // 1. Navigate to home page
    await setup.homePage.navigate();

    // 2. Verify home page is visible
    const isHomePageVisible = await setup.homePage.isVisible();
    if (!isHomePageVisible) {
      throw new Error('Home page is not visible');
    }

    // 3. Verify scenes card is visible
    const isScenesCardVisible = await setup.homePage.hasScenesCard();
    if (!isScenesCardVisible) {
      throw new Error('Scenes card is not visible');
    }

    // 4. Click on scenes see all card banner to navigate to scenes page
    await setup.homePage.clickScenesSeeAllCardBanner();

    // 5. Verify we're on the scenes page
    const isScenesPageVisible = await setup.scenesPage.isVisible();
    if (!isScenesPageVisible) {
      throw new Error('Scenes page is not visible');
    }

    // 6. Click on new scene button to navigate to templates page
    await setup.scenesPage.clickCreateNewScene();

    // 7. Verify we're on the templates page
    const isTemplatesPageVisible = await setup.templatesPage.isVisible();
    if (!isTemplatesPageVisible) {
      throw new Error('Templates page is not visible');
    }

    // 8. Click on new scene button to open create project modal
    await setup.templatesPage.clickNewSceneButton();

    // 9. Verify create project modal is visible
    const isModalVisible = await setup.createProjectModal.isVisible();
    if (!isModalVisible) {
      throw new Error('Create project modal is not visible');
    }

    // 10. Fill project name
    await setup.createProjectModal.fillProjectName(sceneName);

    // 11. Fill project path with the temp directory
    await setup.createProjectModal.fillProjectPath(getTestScenesDir(sceneName));

    // 12. Click create button
    await setup.createProjectModal.clickCreateButton();

    // 13. Verify we're on the editor page
    await this.waitForSceneLoad(setup);
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
   * Open scene in editor
   */
  static async openSceneInEditor(setup: TestSetup, sceneName: string = SCENE_NAME): Promise<void> {
    // Click on the scene to open it
    await setup.scenesPage.clickOnScene(sceneName);

    // Verify we're on the editor page
    await this.waitForSceneLoad(setup);
  }

  /**
   * Verify preview button is visible
   */
  static async verifyPreviewButtonIsVisible(setup: TestSetup): Promise<void> {
    expect(await setup.editorPage.isPreviewButtonVisible()).toBe(true);
  }

  /**
   * Verify preview button is enabled
   */
  static async verifyPreviewButtonIsEnabled(setup: TestSetup): Promise<void> {
    await this.verifyPreviewButtonIsVisible(setup);
    await expect(setup.editorPage.getPreviewButton()).toBeEnabled({ timeout: 120_000 });
  }

  /**
   * Verify publish button is visible
   */
  static async verifyPublishButtonIsVisible(setup: TestSetup): Promise<void> {
    expect(await setup.editorPage.isPublishButtonVisible()).toBe(true);
  }

  /**
   * Verify publish button is enabled
   */
  static async verifyPublishButtonIsEnabled(setup: TestSetup): Promise<void> {
    await this.verifyPublishButtonIsVisible(setup);
    await expect(setup.editorPage.getPublishButton()).toBeEnabled({ timeout: 120_000 });
  }
}
