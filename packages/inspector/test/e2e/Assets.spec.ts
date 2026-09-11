import { type Page } from 'playwright';
import { AssetsTab } from '../../src/redux/ui/types';
import { App } from './pageObjects/App';
import { Assets } from './pageObjects/Assets';
import { Hierarchy } from './pageObjects/Hierarchy';
import { installMouseHelper } from './utils/install-mouse-helper';

declare const page: Page;

describe('Assets', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    // Page is already navigated in setup
    await App.waitUntilReady();
  });

  test('Drag asset from file system into renderer', async () => {
    // There should not be an entity in the Hierarchy tree with the name example.glb at the start
    await expect(Hierarchy.getId('example.glb')).rejects.toThrow();

    await Assets.selectTab(AssetsTab.FileSystem);
    await Assets.openFolder('Models');
    await Assets.openFolder('Models/example');

    await Assets.addFileSystemAsset('Models/example/model.glb');

    // There should be an entity in the Hierarchy tree with the name model.glb
    await expect(Hierarchy.getId('model.glb')).resolves.toBeGreaterThanOrEqual(152);
  });

  test('Drag asset from the file system TREE into renderer', async () => {
    // A second instance of the same model is auto-suffixed (`model.glb_2`).
    const entities = page.locator('.Hierarchy .Tree[data-test-label^="model.glb"]');
    const before = await entities.count();

    await Assets.selectTab(AssetsTab.FileSystem);
    await Assets.addFileSystemAssetFromTree('Models/example/model.glb');

    await entities.nth(before).waitFor({ state: 'attached', timeout: 10_000 });
    await expect(entities.count()).resolves.toBe(before + 1);
  });

  test('Drag asset from Builder into renderer', async () => {
    // There should not be an entity in the Hierarchy tree with the name Pebbles at the start
    await expect(Hierarchy.getId('Pebbles')).rejects.toThrow();

    await Assets.selectTab(AssetsTab.AssetsPack);
    await Assets.selectAssetPack('Voxels Pack');
    await Assets.addBuilderAsset('Pebbles');

    // There should be an entity in the Hierarchy tree with the name Pebbles
    await expect(Hierarchy.getId('Pebbles')).resolves.toBeGreaterThanOrEqual(152);
  });

  test('Name tooltip sits right above the tile in search results, as in the category view', async () => {
    const categoryGap = await Assets.getNameTooltipGapAbove('Bookshelf');
    await Assets.search('Bookshelf');
    const searchGap = await Assets.getNameTooltipGapAbove('Bookshelf');
    expect(Math.abs(searchGap - categoryGap)).toBeLessThan(2);
  });
});
