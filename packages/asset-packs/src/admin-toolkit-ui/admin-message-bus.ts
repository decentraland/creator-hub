import type { Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import type { ISDKHelpers } from '../definitions';
import {
  ADMIN_MESSAGES,
  EMPTY_ANNOUNCEMENT,
  applyAnnouncement,
  applySetVideo,
  connectAdminRoom,
  seedDefaultVideos,
  type AnnouncementCommand,
  type SetVideoCommand,
} from '../admin-commands';

export interface AdminMessageBusInstance {
  emitSetVideo(entity: Entity, props: Partial<PBVideoPlayer>): void;
  emitSetAnnouncement(text: string, author?: string, id?: string): void;
  emitClearAnnouncement(): void;
  emitSyncAdmins(): void;
}

let instance: AdminMessageBusInstance | null = null;

export function getAdminMessageBus(): AdminMessageBusInstance {
  if (!instance) throw new Error('AdminMessageBus not initialized');
  return instance;
}

/**
 * Sends admin commands to the authoritative server, which validates the sender and
 * owns VideoPlayer/TextAnnouncements. Without a server room, commands apply locally.
 */
export function initAdminMessageBus(
  engine: IEngine,
  adminToolkitUiEntity: Entity,
  sdkHelpers?: ISDKHelpers,
  onAdminsChanged?: () => void,
): AdminMessageBusInstance {
  const room = connectAdminRoom(sdkHelpers);

  if (room) {
    room.onMessage(ADMIN_MESSAGES.ADMINS_CHANGED, () => onAdminsChanged?.());
  } else {
    applyAnnouncement(engine, adminToolkitUiEntity, EMPTY_ANNOUNCEMENT);
    seedDefaultVideos(engine);
  }

  function setVideo(command: SetVideoCommand) {
    if (room) room.send(ADMIN_MESSAGES.SET_VIDEO, command).catch(() => {});
    else applySetVideo(engine, command);
  }

  function setAnnouncement(announcement: AnnouncementCommand) {
    if (room) room.send(ADMIN_MESSAGES.SET_ANNOUNCEMENT, announcement).catch(() => {});
    else applyAnnouncement(engine, adminToolkitUiEntity, announcement);
  }

  instance = {
    emitSetVideo(entity, { src, playing, volume, loop, position }) {
      setVideo({ entity, src, playing, volume, loop, position });
    },

    emitSetAnnouncement(text, author, id) {
      setAnnouncement({ text, author: author ?? '', id: id ?? '' });
    },

    emitClearAnnouncement() {
      if (room) room.send(ADMIN_MESSAGES.CLEAR_ANNOUNCEMENT, {}).catch(() => {});
      else applyAnnouncement(engine, adminToolkitUiEntity, EMPTY_ANNOUNCEMENT);
    },

    emitSyncAdmins() {
      room?.send(ADMIN_MESSAGES.SYNC_ADMINS, {}).catch(() => {});
    },
  };

  return instance;
}
