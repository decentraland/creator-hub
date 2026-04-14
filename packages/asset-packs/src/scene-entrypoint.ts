import type { IEngine } from '@dcl/ecs';
import { createInputSystem, createPointerEventsSystem, createTweenSystem } from '@dcl/ecs';
import { createReactBasedUiSystem } from '@dcl/react-ecs';
import type { IPlayersHelper, ISDKHelpers } from './definitions';
import { createComponents, initComponents, getComponents } from './definitions';
import { createActionsSystem, initActions } from './actions';
import { createTriggersSystem, initTriggers } from './triggers';
import { createTimerSystem } from './timer';
import { getExplorerComponents as getEngineComponents } from './components';
import { createTransformSystem } from './transform';
import { createInputActionSystem } from './input-actions';
import { createCounterBarSystem } from './counter-bar';
import { createAdminToolkitSystem } from './admin-toolkit';
import type { CustomItemRegistry } from './types';
import {
  registerCustomItems,
  setSpawnCustomItemImpl,
  spawnCustomItemFromComposite,
  getCustomItemEntry,
} from './spawn-custom-item';

let initialized: boolean = false;
/**
 * the _args param is there to mantain backwards compatibility with all versions.
 * Before it was initAssetPacks(engine, pointerEventsSystem, components)
 */
export function initAssetPacks(
  _engine: unknown,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
  customItems?: CustomItemRegistry,
) {
  // Avoid creating the same systems if asset-pack is called more than once
  if (initialized) return;
  initialized = true;

  const engine = _engine as IEngine;

  // Register custom-item composites so spawnCustomItem() can resolve them
  if (customItems) {
    registerCustomItems(customItems);
  }

  try {
    // get engine components
    const components = getEngineComponents(engine);

    // create asset packs components
    createComponents(engine);

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

    // Wire up spawnCustomItem() now that all systems (and their module-level
    // internalInit* references) are in place.
    const { Transform } = getEngineComponents(engine);
    const { Triggers } = getComponents(engine);

    setSpawnCustomItemImpl((assetId, spawnTransform) => {
      const entry = getCustomItemEntry(assetId);
      if (!entry) {
        console.warn(`[spawnCustomItem] Unknown assetId "${assetId}". Make sure it is included in the customItems registry passed to initAssetPacks.`);
        return undefined;
      }

      return spawnCustomItemFromComposite(
        entry.composite,
        entry.base,
        engine,
        Transform,
        Triggers,
        sdkHelpers,
        spawnTransform,
        (allEntities) => {
          // Initialize actions and triggers on every spawned entity.
          // This is done here (not inside spawnCustomItemFromComposite) to
          // avoid a circular import between spawn-custom-item ↔ actions/triggers.
          for (const entity of allEntities) {
            initActions(entity);
            initTriggers(entity);
          }
        },
      );
    });
  } catch (error) {
    console.error(`Error initializing Asset Packs: ${(error as Error).message}`);
  }
}
