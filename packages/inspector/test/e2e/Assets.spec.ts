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
  }, 30_000);

  test('Drag asset from file system into renderer', async () => {
    // There should not be an entity in the Hierarchy tree with the name example.glb at the start
    await expect(Hierarchy.getId('example.glb')).rejects.toThrow();

    await Assets.selectTab(AssetsTab.FileSystem);
    await Assets.openFolder('scene');
    await Assets.openFolder('scene/Models');
    await Assets.openFolder('scene/Models/example');

    await Assets.addFileSystemAsset('scene/Models/example/model.glb');

    // There should be an entity in the Hierarchy tree with the name model.glb
    await expect(Hierarchy.getId('model.glb')).resolves.toBeGreaterThanOrEqual(152);
  }, 30_000);

  test('Drag asset from Builder into renderer', async () => {
    // There should not be an entity in the Hierarchy tree with the name Pebbles at the start
    await expect(Hierarchy.getId('Pebbles')).rejects.toThrow();

    await Assets.selectTab(AssetsTab.AssetsPack);
    await Assets.selectAssetPack('Voxels Pack');
    await Assets.addBuilderAsset('Pebbles');

    // There should be an entity in the Hierarchy tree with the name Pebbles
    await expect(Hierarchy.getId('Pebbles')).resolves.toBeGreaterThanOrEqual(152);
  }, 30_000);
});
