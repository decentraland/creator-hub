import { expect, test } from '../../fixtures';
import {
  createScene,
  deployToAccepted,
  ensSubgraphAvailable,
  openPublishModal,
} from '../../helpers/publish';

const NAME = (process.env.E2E_NAME ?? '').toLowerCase();

test.describe('publish to world', { tag: '@live' }, () => {
  test.skip(
    !process.env.E2E_PRIVATE_KEY || !process.env.E2E_NAME,
    'set E2E_PRIVATE_KEY and E2E_NAME (packages/creator-hub/.env.e2e) to run the @live tier',
  );

  test.beforeEach(async () => {
    test.skip(
      !(await ensSubgraphAvailable()),
      'ens-sepolia subgraph is down — skipping (its name list is a flaky external dependency)',
    );
  });

  test('deploys a new scene to a world the wallet owns', async ({ signedInLive: page }) => {
    await createScene(page);
    await openPublishModal(page);

    await page.locator('[data-testid="publish-modal-initial-option-box-worlds"] button').click();
    await expect(page.locator('[data-testid="publish-modal-names-loading"]')).toHaveCount(0, {
      timeout: 120_000,
    });
    await expect(
      page.locator('[data-testid="publish-modal-publish-to-world-select-world"]'),
    ).toBeVisible({ timeout: 120_000 });

    await page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-ens-provider"]')
      .click();
    await page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-ens-provider-dcl"]')
      .click();

    await page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-select"]')
      .click();
    await page
      .locator(`[data-testid="publish-modal-publish-to-world-select-world-select-item-${NAME}"]`)
      .click({ timeout: 120_000 });

    await page
      .locator('[data-testid="publish-modal-publish-to-world-select-world-action"]')
      .click({ timeout: 120_000 });

    await deployToAccepted(page);
  });
});
