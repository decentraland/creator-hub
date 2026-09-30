import { test } from '../fixtures';
import { EditorPage } from '../pages/EditorPage';
import { PublishModal } from '../pages/PublishModal';
import { ScenesPage } from '../pages/ScenesPage';

const LAND = process.env.E2E_LAND ?? '';

test.describe('publish to land', { tag: '@live' }, () => {
  test.describe.configure({ retries: 2 });

  test.skip(
    !process.env.E2E_PRIVATE_KEY || !process.env.E2E_LAND,
    'set E2E_PRIVATE_KEY and E2E_LAND (packages/creator-hub/.env.e2e) to run the @live tier',
  );

  test('deploys a new scene to a genesis city parcel the wallet owns', async ({ page }) => {
    const scenes = new ScenesPage(page);
    const editor = new EditorPage(page);
    const publishModal = new PublishModal(page);

    await scenes.createBlankScene();
    await editor.waitReady();
    await editor.openPublish();

    await publishModal.chooseLand(LAND);
    await publishModal.deployToAccepted();
  });
});
