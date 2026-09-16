import { expect, test } from '../../fixtures';
import { createScene, deployToAccepted, openPublishModal } from '../../helpers/publish';

const LAND = process.env.E2E_LAND ?? '';

test.describe('publish to land', { tag: '@live' }, () => {
  test.skip(
    !process.env.E2E_PRIVATE_KEY || !process.env.E2E_LAND,
    'set E2E_PRIVATE_KEY and E2E_LAND (packages/creator-hub/.env.e2e) to run the @live tier',
  );

  test('deploys a new scene to a genesis city parcel the wallet owns', async ({
    signedInLive: page,
  }) => {
    await createScene(page);
    await openPublishModal(page);

    await page.locator('[data-testid="publish-modal-initial-option-box-land"] button').click();
    await expect(page.locator('[data-testid="publish-modal-publish-to-land"]')).toBeVisible({
      timeout: 120_000,
    });

    await expect(
      page.locator('[data-testid="publish-modal-publish-to-land-placement"]'),
      'the modal did not place the scene on the parcel E2E_LAND names',
    ).toContainText(LAND, { timeout: 120_000 });

    await page
      .locator('[data-testid="publish-modal-publish-to-land-action"]')
      .click({ timeout: 120_000 });

    await deployToAccepted(page);
  });
});
