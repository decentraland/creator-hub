import type { Page } from 'playwright';

export class HomePage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(): Promise<void> {
    // With MemoryRouter, we can't use page.goto()
    // The app starts on the home page by default
    // Just wait for the page to be ready
    if (await this.isVisible()) {
      return;
    }
    await this.page.getByTestId('navbar-menu-home').click();
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.getByTestId('app').waitFor({ state: 'visible' });
    await this.page.getByTestId('home-page').waitFor({ state: 'visible' });
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.page.getByTestId('home-page').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async hasCreateSceneOption(): Promise<boolean> {
    try {
      await this.page.getByTestId('home-card-scenes').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async hasSignInOption(): Promise<boolean> {
    try {
      await this.page.getByTestId('home-card-sign-in').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async isUserAuthenticated(): Promise<boolean> {
    try {
      await this.page.getByTestId('header-user-menu-avatar-button').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async navigateToScenes(): Promise<void> {
    await this.page.click('.Navbar .ScenesNavItem');
  }

  async clickSignIn(): Promise<void> {
    await this.page.getByTestId('home-card-sign-in-button').click();
  }

  async hasScenesCard(): Promise<boolean> {
    try {
      await this.page.getByTestId('home-card-scenes').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async clickCreateScene(): Promise<void> {
    await this.page.getByTestId('home-card-scenes-start-building-button').click();
  }

  async clickScenesSeeAllCardBanner(): Promise<void> {
    await this.page.getByTestId('home-card-scenes-see-all-card-banner').click();
  }
}
