import type { Entity, IEngine } from '@dcl/ecs';
import { getExplorerComponents } from './components';
import type { ISDKHelpers } from './definitions';
import { getComponents } from './definitions';
import { getSceneAdmins } from './admin-toolkit-ui/ModerationControl/api';
import { isPreview } from './admin-toolkit-ui/fetch-utils';
import {
  ADMIN_MESSAGES,
  ADMIN_TOOLS_ENTITY,
  EMPTY_ANNOUNCEMENT,
  applyAnnouncement,
  applySetVideo,
  connectAdminRoom,
  getVideoPlayers,
  parseAnnouncement,
  parseSetVideo,
  seedDefaultVideos,
} from './admin-commands';

export const AUTH_SERVER_PEER_ID = 'authoritative-server';

// Structural so it compiles against @dcl/ecs versions that predate validateBeforeChange.
type ValidatableComponent = {
  validateBeforeChange(entity: Entity, cb: (value: { senderAddress: string }) => boolean): void;
};

function isValidatable(component: unknown): component is ValidatableComponent {
  return (
    typeof component === 'object' &&
    component !== null &&
    'validateBeforeChange' in component &&
    typeof component.validateBeforeChange === 'function'
  );
}

function acceptOnlyServerWrites(component: unknown, entity: Entity) {
  if (!isValidatable(component)) return;
  component.validateBeforeChange(
    entity,
    ({ senderAddress }) => senderAddress === AUTH_SERVER_PEER_ID,
  );
}

/**
 * Runs on the authoritative server: applies admin commands from verified admins and
 * rejects any client write to the admin-controlled components. CRDT sync carries the
 * result to every client, late joiners included.
 */
export function initAdminToolkitServer(
  engine: IEngine,
  adminToolkitEntity: Entity,
  sdkHelpers?: ISDKHelpers,
) {
  const { TextAnnouncements, VideoControlState } = getComponents(engine);
  const { VideoPlayer } = getExplorerComponents(engine);

  if (!TextAnnouncements.has(adminToolkitEntity)) {
    applyAnnouncement(engine, adminToolkitEntity, EMPTY_ANNOUNCEMENT);
  }
  if (!VideoControlState.has(adminToolkitEntity)) {
    VideoControlState.create(adminToolkitEntity);
  }
  sdkHelpers?.syncEntity?.(
    adminToolkitEntity,
    [VideoControlState.componentId, TextAnnouncements.componentId],
    ADMIN_TOOLS_ENTITY,
  );
  seedDefaultVideos(engine);

  acceptOnlyServerWrites(TextAnnouncements, adminToolkitEntity);
  for (const { entity } of getVideoPlayers(engine)) {
    acceptOnlyServerWrites(VideoPlayer, entity as Entity);
  }

  // null until the first successful fetch; a failed fetch keeps the last known list.
  let admins: Set<string> | null = null;
  let pendingRefresh: Promise<void> | null = null;
  function refreshAdmins() {
    pendingRefresh ??= getSceneAdmins()
      .then(([error, response]) => {
        if (!error && response) admins = new Set(response.map(a => a.admin.toLowerCase()));
      })
      .finally(() => {
        pendingRefresh = null;
      });
    return pendingRefresh;
  }
  void refreshAdmins();

  function isAdmin(from: string | undefined) {
    if (!from) return false;
    if (isPreview()) return true;
    if (!admins) {
      // The initial fetch failed: retry so admins aren't locked out until a restart.
      void refreshAdmins();
      return false;
    }
    return admins.has(from.toLowerCase());
  }

  const room = connectAdminRoom(sdkHelpers);
  if (!room) return;

  room.onMessage(ADMIN_MESSAGES.SET_VIDEO, (data, context) => {
    if (!isAdmin(context?.from)) return;
    const command = parseSetVideo(data);
    if (command) applySetVideo(engine, command);
  });

  room.onMessage(ADMIN_MESSAGES.SET_ANNOUNCEMENT, (data, context) => {
    if (!isAdmin(context?.from)) return;
    const announcement = parseAnnouncement(data);
    if (announcement) applyAnnouncement(engine, adminToolkitEntity, announcement);
  });

  room.onMessage(ADMIN_MESSAGES.CLEAR_ANNOUNCEMENT, (_data, context) => {
    if (!isAdmin(context?.from)) return;
    applyAnnouncement(engine, adminToolkitEntity, EMPTY_ANNOUNCEMENT);
  });

  // Refetching is safe to trigger for anyone; only an admin's request is fanned out.
  room.onMessage(ADMIN_MESSAGES.SYNC_ADMINS, (_data, context) => {
    void refreshAdmins().then(() => {
      if (isAdmin(context?.from)) room.send(ADMIN_MESSAGES.ADMINS_CHANGED, {}).catch(() => {});
    });
  });
}
