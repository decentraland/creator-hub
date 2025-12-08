import type { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import type { ReactBasedUiSystem } from '@dcl/react-ecs';
import type { IPlayersHelper, ISDKHelpers } from './definitions';
import { getComponents } from './definitions';
import { createAdminToolkitUI } from './admin-toolkit-ui';

let adminToolkitEntity: Entity | null = null;

// Create a system to manage the AdminToolkit
export function createAdminToolkitSystem(
  engine: IEngine,
  pointerEventsSystem: PointerEventsSystem,
  reactBasedUiSystem: ReactBasedUiSystem,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  const { AdminTools } = getComponents(engine);

  return function adminToolkitSystem(_dt: number) {
    const adminToolkitEntities = Array.from(engine.getEntitiesWith(AdminTools));
    const hasAdminToolkit = adminToolkitEntities.length > 0;

    // Create admin toolkit UI if the smart item exists and UI hasn't been created
    if (hasAdminToolkit && !adminToolkitEntity) {
      adminToolkitEntity = adminToolkitEntities[0][0];
      createAdminToolkitUI(
        engine,
        pointerEventsSystem,
        reactBasedUiSystem,
        sdkHelpers,
        playersHelper,
      );
    }
    // Remove admin toolkit UI if the smart item is removed
    else if (!hasAdminToolkit && adminToolkitEntity) {
      engine.removeEntity(adminToolkitEntity);
      adminToolkitEntity = null;
    }
  };
}
