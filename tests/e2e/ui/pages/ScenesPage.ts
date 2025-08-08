import type { Page } from 'playwright';

export class ScenesPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(): Promise<void> {
    // With MemoryRouter, we need to click navigation elements
    // Click on the scenes navigation item to navigate
    await this.page.click('.Navbar .ScenesNavItem');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForSelector('.ScenesPage', { state: 'visible' });
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.ScenesPage', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasCreateNewSceneCard(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.Card.CreateNewSceneCard', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasSceneInList(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.Card.SceneCard', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasSceneWithName(sceneName: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(`.Card.SceneCard:has-text("${sceneName}")`, {
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async hasPreviewButton(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.Button.PreviewButton', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async hasDeployButton(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.Button.DeployButton', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async clickCreateNewScene(): Promise<void> {
    await this.page.getByTestId('scene-list-new-scene-button').click();
  }

  async clickOnScene(sceneName: string): Promise<void> {
    await this.page.click(`.Card.SceneCard:has-text("${sceneName}")`);
  }

  async clickPreviewScene(): Promise<void> {
    await this.page.click('.Button.PreviewButton');
  }

  async clickDeployScene(): Promise<void> {
    await this.page.click('.Button.DeployButton');
  }

  async navigateToHome(): Promise<void> {
    // Navigate back to home from scenes page
    await this.page.click('.Navbar .HomeNavItem');
  }
}
