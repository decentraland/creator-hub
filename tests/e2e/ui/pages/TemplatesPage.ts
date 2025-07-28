import type { Page } from 'playwright';

export class TemplatesPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.getByTestId('templates-page').waitFor({ state: 'visible' });
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.page.getByTestId('templates-page').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async clickNewSceneButton(): Promise<void> {
    await this.page.getByTestId('templates-page-new-scene-button').click();
  }
}
