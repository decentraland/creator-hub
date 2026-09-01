import type { Entity, IEngine, PointerEventsSystem } from '@dcl/ecs';
import type { ReactBasedUiSystem } from '@dcl/react-ecs';
import { isServer } from '~system/EngineApi';
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

  // The Admin Toolkit is a CLIENT-ONLY feature: it renders a React UI, opens a
  // text-comms MessageBus, and calls the comms-gatekeeper scene-admin/scene-bans
  // endpoints. SDK7 runs the SAME scene bundle on both the client and the headless
  // authoritative server, so without this guard the toolkit also initializes
  // server-side — where there is no UI to operate it and it only emits failing
  // comms-gatekeeper requests and unsupported (legacy) `EngineApi.subscribe` calls.
  // Resolve the runtime role once; the toolkit stays uninitialized until we know
  // it is a client, and forever on the server. A failed query defaults to client
  // behavior so the toolkit is never lost on a real client.
  let runsOnServer: boolean | undefined = undefined;
  Promise.resolve()
    .then(() => isServer({}))
    .then(result => {
      runsOnServer = result.isServer;
    })
    .catch(() => {
      runsOnServer = false;
    });

  return function adminToolkitSystem(_dt: number) {
    // Skip while the runtime role is still unknown, and permanently on the server.
    if (runsOnServer !== false) return;

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
