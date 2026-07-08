import type { Page } from 'playwright';

/**
 * Page object for the sign-in flow. The interactive elements the tests drive
 * (header sign-in / avatar / sign-out) are keyed off `data-testid` set on the
 * UserMenu component — a bare ".SignInButton" is ambiguous (the logged-out
 * HomePage renders one inside its SignInCard too) and a structural selector
 * would break on layout changes. The sign-in page carries its own `data-testid`
 * too — its `.SignIn` class is purely presentational and could be renamed by a
 * style refactor, so the test asserts against an explicit contract instead.
 *
 * `#UserMenu` stays id-based: that id is load-bearing (the avatar button's
 * `aria-controls` / the menu's `aria-labelledby` reference it), so it is already
 * a stable contract and a parallel test-id would be redundant. This matches the
 * inspector e2e suite's hybrid convention.
 *
 * The renderer uses a MemoryRouter, so there is no URL to assert against — auth
 * state is observed through the rendered DOM.
 */
class AuthPageObject {
  private readonly signInButtonSelector = '[data-testid="user-menu-sign-in"]';
  private readonly avatarButtonSelector = '[data-testid="user-menu-avatar-button"]';
  private readonly signOutMenuItemSelector = '[data-testid="user-menu-sign-out"]';
  private readonly userMenuSelector = '#UserMenu';
  private readonly signInPageSelector = '[data-testid="sign-in-page"]';

  /** Waits until the renderer has rendered the main content. */
  async waitUntilReady(page: Page) {
    await page.waitForSelector('#app main.Main', { state: 'visible' });
  }

  /** Waits for and clicks the header "Sign In" button. */
  async clickSignIn(page: Page) {
    await page.locator(this.signInButtonSelector).click();
  }

  /** True when the logged-out "Sign In" button is visible in the header. */
  async isSignInButtonVisible(page: Page) {
    return page.locator(this.signInButtonSelector).isVisible();
  }

  /** Waits for the sign-in (waiting-for-browser) page to be visible. */
  async waitForSignInPage(page: Page) {
    await page.waitForSelector(this.signInPageSelector, { state: 'visible' });
  }

  /** True when the sign-in page is currently visible. */
  async isSignInPageVisible(page: Page) {
    return page.locator(this.signInPageSelector).isVisible();
  }

  /** Waits for the signed-in state (avatar button in the header). */
  async waitForSignedIn(page: Page) {
    await page.waitForSelector(this.avatarButtonSelector, { state: 'visible' });
  }

  /** True when the signed-in avatar button is visible in the header. */
  async isSignedIn(page: Page) {
    return page.locator(this.avatarButtonSelector).isVisible();
  }

  /** Opens the user menu and clicks "Sign Out". */
  async signOut(page: Page) {
    await page.locator(this.avatarButtonSelector).click();
    await page.waitForSelector(this.userMenuSelector, { state: 'visible' });
    await page.locator(this.signOutMenuItemSelector).click();
  }
}

export const Auth = new AuthPageObject();
