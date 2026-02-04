import type { IEngine } from '@dcl/ecs';

import type { EditorComponents } from '../../../../sdk/components';
import {
  BaseComponentNames,
  VERSIONS_REGISTRY,
  getLatestVersionName,
} from '../../../../sdk/components/versioning/constants';

/**
 * Retrieves the latest version of the Scene component from the engine.
 *
 * This function iterates through the list of known Scene component versions in reverse order,
 * attempting to find the latest version that is present in the engine.
 *
 * @param engine - The engine instance to query for the Scene component.
 * @returns An object containing the latest Scene component and its value, or null if no version is found.
 */
export function getCompositeLatestSceneComponent(engine: IEngine) {
  let component = null;
  const versions = VERSIONS_REGISTRY[BaseComponentNames.SCENE_METADATA];

  // Iterate in reverse order to find the latest component version
  for (let i = versions.length - 1; i >= 0; i--) {
    const versionName = versions[i].versionName;
    const Scene = engine.getComponentOrNull(versionName) as EditorComponents['Scene'] | null;

    if (Scene) {
      const scene = Scene.getMutableOrNull(engine.RootEntity);
      if (scene) {
        component = {
          component: Scene,
          value: scene,
        };
        break;
      }
    }
  }

  return component;
}

export function migrateSceneMetadata(engine: IEngine) {
  const latestComponent = getCompositeLatestSceneComponent(engine);

  if (!latestComponent) return;

  const { component, value } = latestComponent;

  const latestVersionName = getLatestVersionName(BaseComponentNames.SCENE_METADATA);
  const isRunningLatestVersion = component.componentName === latestVersionName;

  if (isRunningLatestVersion) return;
  const oldComponent = component;

  oldComponent.deleteFrom(engine.RootEntity);

  // Remove old version components
  const versions = VERSIONS_REGISTRY[BaseComponentNames.SCENE_METADATA];
  versions.forEach(({ versionName }) => {
    if (versionName !== latestVersionName) {
      engine.removeComponentDefinition(versionName);
    }
  });

  const SceneMetadata = engine.getComponent(latestVersionName) as EditorComponents['Scene'];
  SceneMetadata.createOrReplace(engine.RootEntity, value);
}
