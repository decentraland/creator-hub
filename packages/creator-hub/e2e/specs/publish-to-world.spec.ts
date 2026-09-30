import { test } from '../fixtures';
import { ensSubgraphAvailable } from '../helpers/subgraph';
import { EditorPage } from '../pages/EditorPage';
import { PublishModal } from '../pages/PublishModal';
import { ScenesPage } from '../pages/ScenesPage';

const NAME = (process.env.E2E_NAME ?? '').toLowerCase();

test.describe('publish to world', { tag: '@live' }, () => {
  test.describe.configure({ retries: 2 });

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

  test('deploys a new scene to a world the wallet owns', async ({ page }) => {
    const scenes = new ScenesPage(page);
    const editor = new EditorPage(page);
    const publishModal = new PublishModal(page);

    await scenes.createBlankScene();
    await editor.waitReady();
    await editor.openPublish();

    await publishModal.chooseWorlds();
    await publishModal.selectWorld(NAME);
    await publishModal.deployToAccepted();
  });
});
