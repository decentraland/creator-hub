import type { Entity, IEngine, ISchema, PBVideoPlayer } from '@dcl/ecs';
import { Schemas } from '@dcl/ecs';
import { getExplorerComponents } from './components';
import type { AdminTools, ISDKHelpers, RoomSDK } from './definitions';
import { getComponents } from './definitions';

// The editor starts using entities from [8001].
export const ADMIN_TOOLS_ENTITY = 8000 as Entity;

export const ADMIN_MESSAGES = {
  SET_VIDEO: 'asset-packs:admin:set-video',
  SET_ANNOUNCEMENT: 'asset-packs:admin:set-announcement',
  CLEAR_ANNOUNCEMENT: 'asset-packs:admin:clear-announcement',
  SYNC_ADMINS: 'asset-packs:admin:sync-admins',
  ADMINS_CHANGED: 'asset-packs:admin:admins-changed',
} as const;

const ADMIN_MESSAGE_SCHEMAS: Record<string, ISchema> = {
  [ADMIN_MESSAGES.SET_VIDEO]: Schemas.Map({
    entity: Schemas.Int,
    src: Schemas.Optional(Schemas.String),
    playing: Schemas.Optional(Schemas.Boolean),
    volume: Schemas.Optional(Schemas.Float),
    loop: Schemas.Optional(Schemas.Boolean),
    position: Schemas.Optional(Schemas.Float),
  }),
  [ADMIN_MESSAGES.SET_ANNOUNCEMENT]: Schemas.Map({
    text: Schemas.String,
    author: Schemas.String,
    id: Schemas.String,
  }),
  [ADMIN_MESSAGES.CLEAR_ANNOUNCEMENT]: Schemas.Map({}),
  [ADMIN_MESSAGES.SYNC_ADMINS]: Schemas.Map({}),
  [ADMIN_MESSAGES.ADMINS_CHANGED]: Schemas.Map({}),
};

export type SetVideoCommand = { entity: Entity } & Partial<
  Pick<PBVideoPlayer, 'src' | 'playing' | 'volume' | 'loop' | 'position'>
>;

export type AnnouncementCommand = { text: string; author: string; id: string };

export const EMPTY_ANNOUNCEMENT: AnnouncementCommand = { text: '', author: '', id: '' };

/** The authoritative-server room, or null when the toolchain provides none (local-only mode). */
export function connectAdminRoom(sdkHelpers?: ISDKHelpers): RoomSDK | null {
  return sdkHelpers?.registerMessages?.(ADMIN_MESSAGE_SCHEMAS) ?? null;
}

export function getAdminToolkitVideoControl(engine: IEngine) {
  const { AdminTools } = getComponents(engine);
  const adminToolkitEntities = Array.from(engine.getEntitiesWith(AdminTools));
  return adminToolkitEntities.length > 0 ? adminToolkitEntities[0][1].videoControl : null;
}

export function getVideoPlayers(
  engine: IEngine,
): NonNullable<AdminTools['videoControl']['videoPlayers']> {
  const videoPlayers = getAdminToolkitVideoControl(engine)?.videoPlayers;
  return videoPlayers ? Array.from(videoPlayers) : [];
}

/** Starts every admin-controlled screen on its deploy-time URL. */
export function seedDefaultVideos(engine: IEngine) {
  const { VideoPlayer } = getExplorerComponents(engine);
  const { VideoScreen } = getComponents(engine);
  for (const { entity } of getVideoPlayers(engine)) {
    const defaultURL = VideoScreen.getOrNull(entity as Entity)?.defaultURL;
    const video = VideoPlayer.getOrNull(entity as Entity);
    if (video && defaultURL && video.src !== defaultURL) {
      VideoPlayer.getMutable(entity as Entity).src = defaultURL;
    }
  }
}

export function applySetVideo(engine: IEngine, command: SetVideoCommand): boolean {
  const { VideoPlayer } = getExplorerComponents(engine);
  if (!getVideoPlayers(engine).some(vp => vp.entity === command.entity)) return false;
  const video = VideoPlayer.getMutableOrNull(command.entity);
  if (!video) return false;

  if (command.src !== undefined) video.src = command.src;
  if (command.playing !== undefined) video.playing = command.playing;
  if (command.volume !== undefined) video.volume = command.volume;
  if (command.loop !== undefined) video.loop = command.loop;
  if (command.position !== undefined) video.position = command.position;
  if (getAdminToolkitVideoControl(engine)?.disableVideoPlayersSound) video.volume = 0;
  return true;
}

export function applyAnnouncement(
  engine: IEngine,
  adminToolkitEntity: Entity,
  announcement: AnnouncementCommand,
) {
  const { TextAnnouncements } = getComponents(engine);
  TextAnnouncements.createOrReplace(adminToolkitEntity, { ...announcement });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optional<T>(value: unknown, type: 'string' | 'number' | 'boolean'): T | undefined {
  return typeof value === type ? (value as T) : undefined;
}

export function parseSetVideo(data: unknown): SetVideoCommand | null {
  if (!isRecord(data) || typeof data.entity !== 'number') return null;
  return {
    entity: data.entity as Entity,
    src: optional<string>(data.src, 'string'),
    playing: optional<boolean>(data.playing, 'boolean'),
    volume: optional<number>(data.volume, 'number'),
    loop: optional<boolean>(data.loop, 'boolean'),
    position: optional<number>(data.position, 'number'),
  };
}

export function parseAnnouncement(data: unknown): AnnouncementCommand | null {
  if (!isRecord(data) || typeof data.text !== 'string' || typeof data.id !== 'string') return null;
  return {
    text: data.text,
    author: typeof data.author === 'string' ? data.author : '',
    id: data.id,
  };
}
