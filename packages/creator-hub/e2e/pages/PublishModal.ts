import { expect } from '@playwright/test';
import type { Page } from 'playwright';

const PREPARE_TIMEOUT = 300_000;
const SELECT_TIMEOUT = 120_000;
const DEPLOY_ACCEPT_TIMEOUT = 600_000;

/** Page object for the publish modal: target choice, name/parcel selection, and deploy. */
export class PublishModal {
  constructor(private readonly page: Page) {}

  /** Chooses the "Worlds" target and waits for the name selector to finish loading. */
  async chooseWorlds() {
    await this.page
      .locator('[data-testid="publish-modal-initial-option-box-worlds"] button')
      .click();
    await expect(this.page.locator('[data-testid="publish-modal-names-loading"]')).toHaveCount(0, {
      timeout: SELECT_TIMEOUT,
    });
    await expect(
      this.page.locator('[data-testid="publish-modal-publish-to-world-select-world"]'),
    ).toBeVisible({ timeout: SELECT_TIMEOUT });
  }

  /** Selects the DCL NAME `name` (lowercased subdomain, e.g. `e2e.dcl.eth`) and confirms it. */
  async selectWorld(name: string) {
    await this.page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-ens-provider"]')
      .click();
    await this.page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-ens-provider-dcl"]')
      .click();
    await this.page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-select"]')
      .click();
    await this.page
      .locator(`[data-testid="publish-modal-publish-to-world-select-world-select-item-${name}"]`)
      .click({ timeout: SELECT_TIMEOUT });
    await this.page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-action"]')
      .click({ timeout: SELECT_TIMEOUT });
  }

  /** Chooses the "Land" target, asserts the auto-placement names `land`, and confirms. */
  async chooseLand(land: string) {
    await this.page.locator('[data-testid="publish-modal-initial-option-box-land"] button').click();
    await expect(this.page.locator('[data-testid="publish-modal-publish-to-land"]')).toBeVisible({
      timeout: SELECT_TIMEOUT,
    });
    await expect(
      this.page.locator('[data-testid="publish-modal-publish-to-land-placement"]'),
      'the modal did not place the scene on the parcel E2E_LAND names',
    ).toContainText(land, { timeout: SELECT_TIMEOUT });
    await this.page
      .locator('[data-testid="publish-modal-publish-to-land-action"]')
      .click({ timeout: SELECT_TIMEOUT });
  }

  /**
   * Runs the deploy step and resolves once the content server accepts the deployment.
   *
   * @remarks Stops at the upload step turning `complete`, not at `publish-modal-deploy-success`.
   * Fails fast on a deploy error (the app's own Retry navigates back, so it is not driven here);
   * transient catalyst rejections are absorbed by the spec's Playwright `retries` — see
   * docs/testing-standards.md.
   */
  async deployToAccepted() {
    await expect(this.page.locator('[data-testid="publish-modal-deploy"]')).toBeVisible({
      timeout: PREPARE_TIMEOUT,
    });

    await this.page
      .locator('[data-testid="publish-modal-deploy-publish-button"] button')
      .click({ timeout: PREPARE_TIMEOUT });

    const warningContinue = this.page.locator(
      '[data-testid="publish-modal-deploy-warning-continue-button"]',
    );
    if (await warningContinue.isVisible()) await warningContinue.click();

    const accepted = this.page.locator(
      [
        '[data-testid="publish-modal-deploy-step-uploading"][data-state="complete"]',
        '[data-testid="publish-modal-deploy-deploying-jump"]',
        '[data-testid="publish-modal-deploy-success"]',
      ].join(', '),
    );
    const failed = this.page.locator('[data-testid="publish-modal-deploy-error"]');

    await expect(
      accepted.or(failed).first(),
      'the deploy step never reported an outcome',
    ).toBeVisible({ timeout: DEPLOY_ACCEPT_TIMEOUT });

    if (await failed.isVisible()) {
      const message = (await failed.textContent())?.replace(/\s+/g, ' ').trim();
      throw new Error(`the content server rejected the deployment: ${message ?? 'unknown error'}`);
    }
  }
}
