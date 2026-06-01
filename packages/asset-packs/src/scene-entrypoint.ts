import type { IEngine } from '@dcl/ecs';
import {
  createInputSystem,
  createPointerEventsSystem,
  createTweenSystem,
  getCompositeProvider,
  setCompositeProvider,
} from '@dcl/ecs';
import { createReactBasedUiSystem } from '@dcl/react-ecs';
import type { IPlayersHelper, ISDKHelpers } from './definitions';
import { initComponents } from './definitions';
import { createActionsSystem } from './actions';
import { createTriggersSystem } from './triggers';
import { createTimerSystem } from './timer';
import { getExplorerComponents as getEngineComponents } from './components';
import { createTransformSystem } from './transform';
import { createInputActionSystem } from './input-actions';
import { createCounterBarSystem } from './counter-bar';
import { createAdminToolkitSystem } from './admin-toolkit';
import { assetPackProvider, wrapWithAssetPathSubstitution } from './asset-pack-provider';
import { composeProviders } from './compose-providers';

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

    // Register the asset-pack provider. `setCompositeProvider` iterates
    // `provider.schemas` and registers each component pre-seal, replacing the
    // old `createComponents(engine)` side-effect.
    //
    // If the SDK already registered its own provider at boot time (the usual
    // case — `@dcl/sdk/src/index.ts` calls `setCompositeProvider` at module
    // load), we compose with it so SPAWN_ENTITY can still load SDK-served
    // composites. The SDK provider is wrapped with `{assetPath}` substitution
    // so on-disk composites keep their portable placeholder convention.
    //
    // NOTE: this depends on module-load order. If asset-packs is imported
    // before the SDK boot, `getCompositeProvider()` returns null and we install
    // only the asset-pack provider; SDK composites become unavailable until
    // the SDK registers its provider on top. In practice the auto-generated
    // scene entrypoint imports `@dcl/sdk` first (which boots and sets its
    // provider) before the user-land entrypoint runs `initAssetPacks`, so this
    // path is the common one. Asserted at runtime by the `sdkProvider` check
    // below; the fallback exists for completeness.
    const sdkProvider = getCompositeProvider();
    if (sdkProvider) {
      setCompositeProvider(
        engine,
        composeProviders([wrapWithAssetPathSubstitution(sdkProvider), assetPackProvider]),
      );
    } else {
      setCompositeProvider(engine, assetPackProvider);
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
