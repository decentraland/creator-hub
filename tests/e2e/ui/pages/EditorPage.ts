import type { Locator, Page } from 'playwright';

export class EditorPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.getByTestId('editor-page').waitFor({ state: 'visible' });
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.page.getByTestId('editor-page').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async waitForLoadingToBeVisible(): Promise<void> {
    await this.page.getByTestId('editor-page-loading').waitFor({ state: 'visible' });
  }

  async waitForIframeToBeVisible(): Promise<void> {
    await this.page
      .getByTestId('editor-page-iframe')
      .waitFor({ state: 'visible', timeout: 120_000 });
  }

  getPreviewButtonGroup(): Locator {
    return this.page.getByTestId('editor-page-preview-button-group');
  }

  getPreviewButton(): Locator {
    return this.getPreviewButtonGroup().getByTestId('button-group-button');
  }

  getPreviewButtonGroupExtraButton(): Locator {
    return this.getPreviewButtonGroup().getByTestId('button-group-extra-button');
  }

  getPreviewButtonGroupPopper(): Locator {
    return this.getPreviewButtonGroup().getByTestId('button-group-popper');
  }

  async isPreviewButtonVisible(): Promise<boolean> {
    try {
      await this.getPreviewButton().waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async clickPreviewButton(): Promise<void> {
    await this.getPreviewButton().click();
  }

  async clickPreviewButtonGroupExtraButton(): Promise<void> {
    await this.getPreviewButtonGroupExtraButton().click();
  }

  getPreviewOptions(): Locator {
    return this.page.getByTestId('editor-page-preview-options');
  }

  getPreviewOptionsDebugger(): Locator {
    return this.getPreviewOptions().getByTestId('editor-page-preview-options-debugger');
  }

  getPreviewOptionsOpenNewInstance(): Locator {
    return this.getPreviewOptions().getByTestId('editor-page-preview-options-open-new-instance');
  }

  getPreviewOptionsLandscapeTerrainEnabled(): Locator {
    return this.getPreviewOptions().getByTestId(
      'editor-page-preview-options-landscape-terrain-enabled',
    );
  }

  async isPreviewOptionsDebuggerChecked(): Promise<boolean> {
    return this.getPreviewOptionsDebugger().isChecked();
  }

  async checkPreviewOptionsDebugger(): Promise<void> {
    await this.getPreviewOptionsDebugger().check();
  }

  async uncheckPreviewOptionsDebugger(): Promise<void> {
    await this.getPreviewOptionsDebugger().uncheck();
  }

  getPublishButton(): Locator {
    return this.page.getByTestId('editor-page-publish-button');
  }

  async isPublishButtonVisible(): Promise<boolean> {
    try {
      await this.getPublishButton().waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async clickPublishButton(): Promise<void> {
    await this.getPublishButton().click();
  }

  getBackButton(): Locator {
    return this.page.getByTestId('editor-page-back-button');
  }

  async clickBackButton(): Promise<void> {
    await this.getBackButton().click();
  }

  async isInstallClientModalVisible(): Promise<boolean> {
    try {
      await this.page.getByTestId('install-client-modal').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }
}
