import { expect } from '@playwright/test';
import type { Page } from 'playwright';

const SCENE_READY_TIMEOUT = 300_000;
const PUBLISH_PREPARE_TIMEOUT = 300_000;
const IMPORT_TIMEOUT = 120_000;

/** Page object for the scene editor and its embedded inspector iframe. */
export class EditorPage {
  constructor(private readonly page: Page) {}

  /** Waits until the editor and inspector iframe are interactive and the install backdrop is gone. */
  async waitReady() {
    await expect(this.page.locator('[data-testid="editor-page"]')).toBeVisible({
      timeout: SCENE_READY_TIMEOUT,
    });
    await expect(this.page.locator('[data-testid="editor-page-iframe"]')).toBeVisible();
    await expect(this.page.locator('.MuiBackdrop-root:visible')).toHaveCount(0, {
      timeout: SCENE_READY_TIMEOUT,
    });
  }

  /** Imports a `.glb` from the filesystem through the inspector's file input. */
  async importGlb(filePath: string) {
    const inspector = this.page.frameLocator('[data-testid="editor-page-iframe"]');
    const fileInput = inspector.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: IMPORT_TIMEOUT });
    await fileInput.setInputFiles(filePath);
    await inspector
      .locator('.ImportAssetModal')
      .getByRole('button', { name: /^IMPORT/ })
      .click({ timeout: IMPORT_TIMEOUT });
  }

  /** Opens the publish modal and waits for its target options. */
  async openPublish() {
    await this.page.locator('[data-testid="editor-page-publish-button"]').click();
    await expect(this.page.locator('[data-testid="publish-modal-initial-options"]')).toBeVisible({
      timeout: PUBLISH_PREPARE_TIMEOUT,
    });
  }
}
