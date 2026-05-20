import { type Page } from 'playwright';
import { AssetsTab } from '../../src/redux/ui/types';
import { App } from './pageObjects/App';
import { Assets } from './pageObjects/Assets';
import { Hierarchy } from './pageObjects/Hierarchy';
import { Inspector } from './pageObjects/Inspector';
import { installMouseHelper } from './utils/install-mouse-helper';

declare const page: Page;

/**
 * End-to-end coverage for adding a builder asset (smart item) as a child of
 * the scene, asserting that `{assetPath}` placeholders are substituted on
 * spawn.
 *
 * Why Siren: its catalog composite carries both signals in one drag —
 *   - `core::GltfContainer.src = "{assetPath}/Siren.glb"`   (top-level
 *     path string; the walker has always handled this correctly)
 *   - `asset-packs::Actions.value[0]` PLAY_SOUND with
 *     `jsonPayload = "{\"src\":\"{assetPath}/siren.mp3\",\"loop\":true}"`
 *     (the regression surface — the walker collapsed this to the bare
 *     base directory before the fix in `deepReplaceAssetPath`).
 *
 * The assertion reads the spawned entity's components directly from
 * `state.sdk.inspectorEngine` (already exposed via `window.store` in
 * `redux/store.ts`). This avoids the EntityInspector UI's smart-item
 * BasicView (`isBasicViewEnabled: true` on Siren's Config), which would
 * never render `.GltfInspector` / `.ActionInspector` for the spawned
 * entity, making any DOM-panel assertion time out.
 */
describe('Add builder asset as child', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    await App.waitUntilReady();
    await Inspector.waitForEngineReady();
  }, 60_000);

  test('Siren spawn substitutes {assetPath} in GltfContainer and PLAY_SOUND Action', async () => {
    await Assets.selectTab(AssetsTab.AssetsPack);
    await Assets.selectAssetPack('Smart Items');
    await Assets.addBuilderAsset('Siren');

    const sirenId = await Hierarchy.getId('Siren');
    expect(sirenId).toBeGreaterThanOrEqual(512);

    // Top-level path field on the spawned entity — substituted, never
    // `{assetPath}`.
    const gltf = (await Inspector.waitForComponent(sirenId, 'core::GltfContainer')) as {
      src?: string;
    } | null;
    expect(gltf).not.toBeNull();
    expect(gltf!.src).toBeDefined();
    expect(gltf!.src).not.toContain('{assetPath}');
    expect(gltf!.src!.toLowerCase()).toContain('.glb');

    // Regression surface: PLAY_SOUND's `jsonPayload.src` must have
    // `{assetPath}` substituted before the inspector engine reads it. With
    // the previous walker behavior the entire `jsonPayload` collapsed to
    // the bare base directory, no `.mp3` would surface anywhere.
    const actions = (await Inspector.waitForComponent(sirenId, 'asset-packs::Actions')) as {
      value?: Array<{ type: string; jsonPayload?: string }>;
    } | null;
    expect(actions).not.toBeNull();
    expect(Array.isArray(actions!.value)).toBe(true);
    const playSound = actions!.value!.find(action => action.type === 'play_sound');
    expect(playSound).toBeDefined();
    expect(playSound!.jsonPayload).toBeDefined();
    const payload = JSON.parse(playSound!.jsonPayload!) as { src?: string };
    expect(payload.src).toBeDefined();
    expect(payload.src).not.toContain('{assetPath}');
    expect(payload.src!.toLowerCase()).toContain('.mp3');
  }, 60_000);
});
