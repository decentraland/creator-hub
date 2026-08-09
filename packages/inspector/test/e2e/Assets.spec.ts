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

  test('Drag asset from Builder into renderer', async () => {
    // There should not be an entity in the Hierarchy tree with the name Pebbles at the start
    await expect(Hierarchy.getId('Pebbles')).rejects.toThrow();

    await Assets.selectTab(AssetsTab.AssetsPack);
    await Assets.selectAssetPack('Voxels Pack');
    await Assets.addBuilderAsset('Pebbles');

    // There should be an entity in the Hierarchy tree with the name Pebbles
    await expect(Hierarchy.getId('Pebbles')).resolves.toBeGreaterThanOrEqual(152);
  });

  test('Keeps a search result name tooltip clear of the results header', async () => {
    await Assets.selectTab(AssetsTab.AssetsPack);
    await page.locator('.assets-catalog-header-title').click();

    const search = page.locator('.assets-catalog-header-search input');
    await search.fill('scanner');

    const asset = page.locator('.assets-catalog-asset[data-test-label="Wearable Scanner"]');
    await asset.waitFor();
    await asset.hover();

    const tooltip = page.locator('.InfoTooltip:visible');
    expect(await tooltip.textContent()).toContain('Wearable Scanner');

    const [assetBox, headerBox, tooltipBox] = await Promise.all([
      asset.boundingBox(),
      page.locator('.assets-catalog-header-title').boundingBox(),
      tooltip.boundingBox(),
    ]);

    expect(assetBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(assetBox!.y);
  });
});
