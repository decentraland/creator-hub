import type { Page } from 'playwright';

/** Page object for the scenes list and the new-scene creation funnel. */
export class ScenesPage {
  constructor(private readonly page: Page) {}

  /** Drives the scenes → templates → create-project funnel that lands in the editor. */
  async createBlankScene() {
    await this.page.locator('[data-testid="navbar-menu-scenes"]').click();
    await this.page.locator('[data-testid="scene-list-new-scene-button"]').click();
    await this.page.locator('[data-testid="templates-page-new-scene-button"]').click();
    await this.page.locator('[data-testid="create-project-modal-create-button"]').click();
  }
}
