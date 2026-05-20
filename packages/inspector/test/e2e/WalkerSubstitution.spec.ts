import { type Page } from 'playwright';
import { AssetsTab } from '../../src/redux/ui/types';
import { App } from './pageObjects/App';
import { Assets } from './pageObjects/Assets';
import { Hierarchy } from './pageObjects/Hierarchy';
import { Inspector } from './pageObjects/Inspector';
import { installMouseHelper } from './utils/install-mouse-helper';

declare const page: Page;

/**
 * End-to-end coverage for `{assetPath}` substitution on spawn.
 *
 * Named to sort after the other e2e specs (W > T): vitest's `singleFork`
 * pool shares one inspector engine across spec files, and the pre-existing
 * Hierarchy spec hard-codes monotonically-increasing entity IDs starting at
 * 512. Spawning a Siren earlier in the run would shift those IDs and break
 * the unrelated specs. Keep this spec last.
 *
 * Why Siren: its catalog composite carries both signals in one drag —
 *   - `core::GltfContainer.src = "{assetPath}/Siren.glb"`   (top-level
 *     path string; the walker has always handled this correctly)
 *   - `asset-packs::Actions.value[0]` = PLAY_SOUND with
 *     `jsonPayload = "{\"src\":\"{assetPath}/siren.mp3\",\"loop\":true}"`
 *     (the regression surface — the walker collapsed this to the bare
 *     base directory before the fix in `deepReplaceAssetPath`).
 *
 * The assertion looks for the substituted file extensions inside the
 * relevant panel text. With the regression the PLAY_SOUND action's
 * `jsonPayload` is wiped to a bare directory and never reaches the
 * inspector with a `.mp3` suffix anywhere.
 */
describe('{assetPath} substitution on spawn', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    await App.waitUntilReady();
  }, 30_000);

  test('Siren spawn substitutes {assetPath} in GltfContainer and PLAY_SOUND Action', async () => {
    await Assets.selectTab(AssetsTab.AssetsPack);
    await Assets.selectAssetPack('Smart Items');
    await Assets.addBuilderAsset('Siren');

    const sirenId = await Hierarchy.getId('Siren');
    expect(sirenId).toBeGreaterThanOrEqual(512);

    // `addAsset` already calls `updateSelectedEntity`, but trigger an
    // explicit click in case selection didn't propagate to the inspector by
    // the time this test runs.
    const sirenItem = await page.$(Hierarchy.getItemSelectorById(sirenId));
    if (sirenItem) await sirenItem.click();

    await Inspector.waitForEntityInspector();

    // Top-level path field: shows the substituted .glb filename.
    await Inspector.waitForPanel('.GltfInspector');
    const gltfText = await Inspector.getPanelText('.GltfInspector');
    expect(gltfText).toContain('.glb');

    // Regression surface: PLAY_SOUND's `jsonPayload.src` must be substituted
    // before the inspector reads it back. With the previous walker behavior
    // the entire `jsonPayload` collapsed to the bare base directory, no
    // `.mp3` would surface anywhere in the action's panel.
    await Inspector.waitForPanel('.PlaySoundActionContainer');
    const playSoundText = await Inspector.getPanelText('.PlaySoundActionContainer');
    expect(playSoundText).toContain('.mp3');
  }, 60_000);
});
