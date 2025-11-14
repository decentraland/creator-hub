import type { Locator, Page } from 'playwright';

export class PublishModal {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Initial Modal
  getInitialModal(): Locator {
    return this.page.getByTestId('publish-modal-initial');
  }

  getSignInButton(): Locator {
    return this.page.getByTestId('publish-modal-initial-sign-in-button');
  }

  getOptions(): Locator {
    return this.page.getByTestId('publish-modal-initial-options');
  }

  getWorldsOption(): Locator {
    return this.page.getByTestId('publish-modal-initial-option-box-worlds').getByRole('button');
  }

  // Publish to World Modal
  getPublishToWorldModal(): Locator {
    return this.page.getByTestId('publish-modal-publish-to-world');
  }

  getEmptyNamesModal(): Locator {
    return this.page.getByTestId('publish-modal-empty-names');
  }

  getWorldSelectionModal(): Locator {
    return this.page.getByTestId('publish-modal-publish-to-world-select-world');
  }

  getWorldSelect(): Locator {
    return this.page.getByTestId('publish-modal-publish-to-world-select-world-select');
  }

  getWorldSelectItem(worldName: string): Locator {
    return this.page.getByTestId(
      `publish-modal-publish-to-world-select-world-select-item-${worldName.toLowerCase()}`,
    );
  }

  getWorldSelectionAction(): Locator {
    return this.page.getByTestId('publish-modal-publish-to-world-select-world-action');
  }

  getWorldReplaceContentModal(): Locator {
    return this.page.getByTestId(
      'publish-modal-publish-to-world-select-world-confirm-world-replace-content',
    );
  }

  getWorldReplaceContentCheckbox(): Locator {
    return this.page.getByTestId(
      'publish-modal-publish-to-world-select-world-confirm-world-replace-content-checkbox',
    );
  }

  // Deploy Modal
  getDeployModal(): Locator {
    return this.page.getByTestId('publish-modal-deploy');
  }

  getDeployPublishButton(): Locator {
    return this.page.getByTestId('publish-modal-deploy-publish-button');
  }

  getDeployWarning(): Locator {
    return this.page.getByTestId('publish-modal-deploy-warning');
  }

  getDeployWarningContinueButton(): Locator {
    return this.page.getByTestId('publish-modal-deploy-warning-continue-button');
  }

  getDeployingModal(): Locator {
    return this.page.getByTestId('publish-modal-deploy-deploying');
  }

  getDeployJumpContainer(): Locator {
    return this.page.getByTestId('publish-modal-deploy-deploying-jump');
  }

  getSuccessModal(): Locator {
    return this.page.getByTestId('publish-modal-deploy-success');
  }

  // Actions
  async waitForInitialModal(): Promise<void> {
    await this.getInitialModal().waitFor({ state: 'visible', timeout: 120_000 });
  }

  async clickSignIn(): Promise<void> {
    await this.getSignInButton().click();
  }

  async clickWorldsOption(): Promise<void> {
    await this.getWorldsOption().click();
  }

  async selectWorld(worldName: string): Promise<void> {
    // Open the world select
    await this.getWorldSelect().click();

    // Select the world
    await this.getWorldSelectItem(worldName).click();
  }

  async clickWorldSelectionAction(): Promise<void> {
    await this.getWorldSelectionAction().click();
  }

  async checkWorldReplaceContent(): Promise<void> {
    await this.getWorldReplaceContentCheckbox().check();
  }

  async clickDeployPublishButton(): Promise<void> {
    await this.getDeployPublishButton().click();
  }

  async clickDeployWarningContinue(): Promise<void> {
    await this.getDeployWarningContinueButton().click();
  }

  async waitForDeployJumpButton(timeout: number = 300_000): Promise<void> {
    await this.getDeployJumpContainer().waitFor({ state: 'visible', timeout });
  }

  async waitForSuccessModal(timeout: number = 300_000): Promise<void> {
    await this.getSuccessModal().waitFor({ state: 'visible', timeout });
  }

  // Checks
  async hasEmptyNames(): Promise<boolean> {
    return this.getEmptyNamesModal().isVisible();
  }

  async hasWorldReplaceContent(): Promise<boolean> {
    return this.getWorldReplaceContentModal().isVisible();
  }

  async hasDeployWarning(): Promise<boolean> {
    return this.getDeployWarning().isVisible();
  }
}
