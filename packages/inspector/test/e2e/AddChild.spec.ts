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
 *   - `asset-packs::Actions.value[0]` CALL_SCRIPT_METHOD with
 *     `jsonPayload = "{\"scriptPath\":\"{assetPath}/Alarm.ts\",...}"`
 *     (the regression surface — the walker collapsed this nested path to
 *     the bare base directory before the fix in `deepReplaceAssetPath`).
 *     Siren became a script-backed smart item in the #1354 migration, so
 *     the `{assetPath}` guard now rides on `scriptPath` instead of the old
 *     PLAY_SOUND `src`; the substitution path under test is unchanged.
 *
 * The assertion reads the spawned entity's components directly from
 * `state.sdk.inspectorEngine` (already exposed via `window.store` in
 * `redux/store.ts`), rather than the EntityInspector UI panels — the
 * smart-item BasicView never renders `.GltfInspector` / `.ActionInspector`
 * for a spawned entity, so any DOM-panel assertion would time out.
 */
describe('Add builder asset as child', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    await App.waitUntilReady();
    await Inspector.waitForEngineReady();
  }, 60_000);

  test('Siren spawn substitutes {assetPath} in GltfContainer and script-method Action', async () => {
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

    // Regression surface: CALL_SCRIPT_METHOD's `jsonPayload.scriptPath` must
    // have `{assetPath}` substituted before the inspector engine reads it.
    // With the previous walker behavior the entire `jsonPayload` collapsed to
    // the bare base directory, no `.ts` would surface anywhere.
    const actions = (await Inspector.waitForComponent(sirenId, 'asset-packs::Actions')) as {
      value?: Array<{ type: string; jsonPayload?: string }>;
    } | null;
    expect(actions).not.toBeNull();
    expect(Array.isArray(actions!.value)).toBe(true);
    const callScript = actions!.value!.find(action => action.type === 'call_script_method');
    expect(callScript).toBeDefined();
    expect(callScript!.jsonPayload).toBeDefined();
    const payload = JSON.parse(callScript!.jsonPayload!) as { scriptPath?: string };
    expect(payload.scriptPath).toBeDefined();
    expect(payload.scriptPath).not.toContain('{assetPath}');
    expect(payload.scriptPath!.toLowerCase()).toContain('.ts');
  }, 60_000);
});
