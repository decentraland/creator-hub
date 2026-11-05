import type { WorldSettings } from '/@/lib/worlds';
import { MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';

export const MIDDAY_SECONDS = 43200;
const MIDNIGHT_SECONDS = 86400;
const LAST_MINUTE_SECONDS = 86340;
const INTEGER = /^-?\d+$/;
const HH_MM = /^(\d{1,2}):(\d{2})$/;

export type SettingsDraft = {
  x: string;
  y: string;
  skyboxTime: number | null;
  singlePlayer: boolean;
  showInPlaces: boolean;
};

/** The Settings fields of a World, as the form edits them; a saved midnight (86400) reads 00:00. */
export function toSettingsDraft(settings: WorldSettings): SettingsDraft {
  const [x = '', y = ''] = (settings.spawnCoordinates ?? '').split(',');
  const skyboxTime = settings.skyboxTime ?? null;
  return {
    x,
    y,
    skyboxTime: skyboxTime === MIDNIGHT_SECONDS ? 0 : skyboxTime,
    singlePlayer: !!settings.singlePlayer,
    showInPlaces: !!settings.showInPlaces,
  };
}

/** The settings the form changed, ready for `updateWorldSettings`; 00:00 is sent as 86400. */
export function settingsChanges(
  draft: SettingsDraft,
  saved: WorldSettings,
): Partial<WorldSettings> {
  const base = toSettingsDraft(saved);
  const changes: Partial<WorldSettings> = {};
  if ((draft.x !== base.x || draft.y !== base.y) && draft.x && draft.y)
    changes.spawnCoordinates = `${draft.x},${draft.y}`;
  if (draft.skyboxTime !== base.skyboxTime)
    changes.skyboxTime = draft.skyboxTime === 0 ? MIDNIGHT_SECONDS : draft.skyboxTime;
  if (draft.singlePlayer !== base.singlePlayer) changes.singlePlayer = draft.singlePlayer;
  if (draft.showInPlaces !== base.showInPlaces) changes.showInPlaces = draft.showInPlaces;
  return changes;
}

const isCoordinate = (value: string) =>
  INTEGER.test(value) && Number(value) >= MIN_COORDINATE && Number(value) <= MAX_COORDINATE;

/** Whether the form can be saved: no spawn at all, or both coordinates whole numbers inside the World bounds. */
export const settingsValid = (draft: SettingsDraft) =>
  (!draft.x && !draft.y) || (isCoordinate(draft.x) && isCoordinate(draft.y));

/** Seconds since midnight as HH:MM. */
export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** HH:MM as seconds since midnight, or null when it isn't a time of day. */
export function parseTime(value: string): number | null {
  const match = HH_MM.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60;
  return Number(match[2]) < 60 && seconds <= LAST_MINUTE_SECONDS ? seconds : null;
}
