import type { IEngine } from '@dcl/ecs';
import {
  createInputSystem,
  createPointerEventsSystem,
  createTweenSystem,
  getCompositeProvider,
  setCompositeProvider,
} from '@dcl/ecs';
import { polyfillTextEncoder } from '@dcl/sdk/text-codec';
import { createReactBasedUiSystem } from '@dcl/react-ecs';
import type { IPlayersHelper, ISDKHelpers } from './definitions';
import { createComponents, initComponents } from './definitions';
import { createActionsSystem } from './actions';
import { createTriggersSystem } from './triggers';
import { createTimerSystem } from './timer';
import { getExplorerComponents as getEngineComponents } from './components';
import { createTransformSystem } from './transform';
import { createInputActionSystem } from './input-actions';
import { createCounterBarSystem } from './counter-bar';
import { createAdminToolkitSystem } from './admin-toolkit';
import { createUIRuntimeSystem } from './ui-runtime';
import { wrapWithAssetPathSubstitution } from './asset-pack-provider';

let initialized: boolean = false;
// TODO: enforce via ESLint `no-restricted-imports` that the global `engine`
// from `@dcl/ecs` is only imported in this entrypoint and the asset-packs
// `index.ts` — all other files must accept `engine` as a parameter. With
// `setCompositeProvider`/`getCompositeProvider` now living as module-level
// free functions, mixing engines silently breaks composite resolution.
/**
 * the _args param is there to mantain backwards compatibility with all versions.
 * Before it was initAssetPacks(engine, pointerEventsSystem, components)
 */
export function initAssetPacks(
  _engine: unknown,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  // Avoid creating the same systems if asset-pack is called more than once
  if (initialized) return;
  initialized = true;

  const engine = _engine as IEngine;

  try {
    // get engine components
    const components = getEngineComponents(engine);

    // Register asset-pack component types pre-seal, the same way the Inspector
    // does (`createComponents` → `engine.defineComponent`). Asset-packs hold the
    // real `ISchema`s, so registering directly avoids the
    // `ISchema → jsonSchema → ISchema` round-trip a `provider.schemas` array
    // would force. The provider therefore ships no schemas; it exists only to
    // resolve composites at spawn time.
    createComponents(engine);

    // Install the TextEncoder/TextDecoder polyfill the QuickJS scene runtime
    // lacks. The SDK's `compositeProvider.loadComposite` — which SPAWN_ENTITY
    // calls to load `composite.json` files at runtime — decodes the file bytes
    // via `TextDecoder`. Sourced from the lean `@dcl/sdk/text-codec` subpath so we
    // don't reach in via `@dcl/sdk/ethereum-provider`. Idempotent
    // (`setGlobalPolyfill` only assigns when the global is absent, so it's a no-op
    // in the browser inspector or when the codec is already present).
    polyfillTextEncoder();

    // Wrap the SDK composite provider so SPAWN_ENTITY can load SDK-served
    // composites with their portable `{assetPath}` placeholders resolved. The SDK
    // registers its provider at boot (`@dcl/sdk/src/index.ts` calls
    // `setCompositeProvider` at module load), so `getCompositeProvider()` returns
    // it here; wrapping + re-registering swaps in the `{assetPath}` substitution
    // pass — the only composite-resolution behavior asset-packs adds.
    //
    // NOTE: this depends on module-load order — if asset-packs initializes before
    // the SDK boots, `getCompositeProvider()` is null. In practice the generated
    // scene entrypoint boots the SDK first.
    const sdkProvider = getCompositeProvider();
    if (sdkProvider) {
      setCompositeProvider(engine, wrapWithAssetPathSubstitution(sdkProvider));
    } else {
      // The SDK provider is what actually resolves and decodes composites;
      // without it SPAWN_ENTITY cannot work. An explicit error beats silently
      // installing a no-op provider.
      console.error(
        '[asset-packs] No SDK composite provider registered; SPAWN_ENTITY cannot ' +
          'resolve composites. Ensure @dcl/sdk boots before initAssetPacks.',
      );
    }

    // create core systems
    const inputSystem = createInputSystem(engine);
    const pointerEventsSystem = createPointerEventsSystem(engine, inputSystem);
    const tweenSystem = createTweenSystem(engine);
    const reactBasedUiSystem = createReactBasedUiSystem(engine as any, pointerEventsSystem as any);

    // create systems that some components needs (VideoPlayer, etc)
    initComponents(engine);
    engine.addSystem(createActionsSystem(engine, pointerEventsSystem, sdkHelpers, playersHelper));
    engine.addSystem(createTriggersSystem(engine, components, pointerEventsSystem, tweenSystem));
    engine.addSystem(createTimerSystem());
    engine.addSystem(createInputActionSystem(inputSystem));
    engine.addSystem(createCounterBarSystem(engine, components));
    engine.addSystem(createTransformSystem(components));
    engine.addSystem(createUIRuntimeSystem(engine, pointerEventsSystem));
    engine.addSystem(
      createAdminToolkitSystem(
        engine,
        pointerEventsSystem,
        reactBasedUiSystem,
        sdkHelpers,
        playersHelper,
      ),
    );
  } catch (error) {
    console.error(`Error initializing Asset Packs: ${(error as Error).message}`);
  }
}
