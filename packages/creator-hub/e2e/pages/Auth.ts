import type { Page } from 'playwright';

/** Page object for the header sign-in / avatar / sign-out flow, keyed off UserMenu data-testids. */
export class Auth {
  private readonly signInButton = '[data-testid="user-menu-sign-in"]';
  private readonly avatarButton = '[data-testid="user-menu-avatar-button"]';
  private readonly signOutMenuItem = '[data-testid="user-menu-sign-out"]';
  private readonly userMenu = '#UserMenu';
  private readonly signInPage = '[data-testid="sign-in-page"]';

  constructor(private readonly page: Page) {}

  /** Waits until the renderer has rendered the main content. */
  async waitUntilReady() {
    await this.page.waitForSelector('#app main.Main', { state: 'visible' });
  }

  /** Clicks the header "Sign In" button. */
  async clickSignIn() {
    await this.page.locator(this.signInButton).click();
  }

  /** True when the logged-out "Sign In" button is visible in the header. */
  isSignInButtonVisible() {
    return this.page.locator(this.signInButton).isVisible();
  }

  /** Waits for the sign-in (waiting-for-browser) page to be visible. */
  async waitForSignInPage() {
    await this.page.waitForSelector(this.signInPage, { state: 'visible' });
  }

  /** True when the sign-in page is currently visible. */
  isSignInPageVisible() {
    return this.page.locator(this.signInPage).isVisible();
  }

  /** Waits for the signed-in state (avatar button in the header). */
  async waitForSignedIn() {
    await this.page.waitForSelector(this.avatarButton, { state: 'visible' });
  }

  /** True when the signed-in avatar button is visible in the header. */
  isSignedIn() {
    return this.page.locator(this.avatarButton).isVisible();
  }

  /** Resolves whether the signed-in state appears within `timeout` ms. */
  async becomesSignedIn(timeout: number) {
    try {
      await this.page.waitForSelector(this.avatarButton, { state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** Opens the user menu and clicks "Sign Out". */
  async signOut() {
    await this.page.locator(this.avatarButton).click();
    await this.page.waitForSelector(this.userMenu, { state: 'visible' });
    await this.page.locator(this.signOutMenuItem).click();
  }
}
