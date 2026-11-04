import type { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import type { ReactBasedUiSystem } from '@dcl/react-ecs';
import { isServer } from '~system/EngineApi';
import type { IPlayersHelper, ISDKHelpers } from './definitions';
import { getComponents } from './definitions';
import { createAdminToolkitUI } from './admin-toolkit-ui';
import { initAdminToolkitServer } from './admin-toolkit-server';

let adminToolkitEntity: Entity | null = null;
let adminToolkitUiRoot: Entity | null = null;

// Create a system to manage the AdminToolkit
export function createAdminToolkitSystem(
  engine: IEngine,
  pointerEventsSystem: PointerEventsSystem,
  reactBasedUiSystem: ReactBasedUiSystem,
  sdkHelpers?: ISDKHelpers,
  playersHelper?: IPlayersHelper,
) {
  const { AdminTools } = getComponents(engine);

  // SDK7 runs the same scene bundle on clients and on the headless authoritative
  // server. The UI is client-only; the server only validates and applies admin
  // commands. A failed role query defaults to client so the UI is never lost.
  let runsOnServer: boolean | undefined = undefined;
  let serverInitialized = false;
  Promise.resolve()
    .then(() => isServer({}))
    .then(result => {
      runsOnServer = result.isServer;
    })
    .catch(() => {
      runsOnServer = false;
    });

  return function adminToolkitSystem(_dt: number) {
    if (runsOnServer === undefined) return;

    const adminToolkitEntities = Array.from(engine.getEntitiesWith(AdminTools));
    const hasAdminToolkit = adminToolkitEntities.length > 0;

    if (runsOnServer) {
      if (hasAdminToolkit && !serverInitialized) {
        serverInitialized = true;
        initAdminToolkitServer(engine, adminToolkitEntities[0][0], sdkHelpers);
      }
      return;
    }

    // Create admin toolkit UI if the smart item exists and UI hasn't been created
    if (hasAdminToolkit && !adminToolkitEntity) {
      adminToolkitEntity = adminToolkitEntities[0][0];
      adminToolkitUiRoot = createAdminToolkitUI(
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
      if (adminToolkitUiRoot) {
        reactBasedUiSystem.removeUiRenderer(adminToolkitUiRoot);
        engine.removeEntity(adminToolkitUiRoot);
        adminToolkitUiRoot = null;
      }
    }
  };
}
