import type { Page } from 'playwright';

export class UserDomain {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async authenticate(): Promise<boolean> {
    try {
      // Click sign in button
      await this.page.click('.Card.SignInCard .SignInButton');

      // Wait for sign-in page to load
      await this.page.waitForSelector('.SignIn', { state: 'visible' });

      // Click MetaMask option to start the flow
      await this.page.click('.WalletOption.MetaMaskOption');

      // Wait for verification code to appear (indicating browser flow started)
      await this.page.waitForSelector('.SignIn .code .verificationCode', { timeout: 30000 });

      // Wait for authentication to complete
      await this.page.waitForSelector('.UserAuthenticated', { timeout: 30000 });

      return true;
    } catch {
      return false;
    }
  }

  async requiresAuthentication(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.Modal.AuthRequiredModal', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.UserMenu', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.page.click('.UserMenu');
      await this.page.click('.Button.SignOutButton');
      await this.page.waitForSelector('.Card.SignInCard');
    } catch {
      // Handle case where user is already signed out
    }
  }

  async getUserAddress(): Promise<string | null> {
    try {
      const addressElement = await this.page.$('.UserAddress');
      if (addressElement) {
        return await addressElement.textContent();
      }
      return null;
    } catch {
      return null;
    }
  }
}
