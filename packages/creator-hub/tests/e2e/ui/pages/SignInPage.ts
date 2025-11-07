import type { Page } from 'playwright';

export class SignInPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(): Promise<void> {
    // With MemoryRouter, we need to click navigation elements
    // Click on the SignInCard to navigate to sign-in page
    await this.page.click('.Card.SignInCard .SignInButton');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.getByTestId('sign-in-page').waitFor({ state: 'visible' });
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.page.getByTestId('sign-in-page').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async hasVerificationCode(): Promise<boolean> {
    try {
      await this.page.getByTestId('sign-in-page-verification-code').waitFor({ state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }
}
