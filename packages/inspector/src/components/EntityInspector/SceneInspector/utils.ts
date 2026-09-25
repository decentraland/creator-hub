import { areConnected } from '@dcl/ecs';
import type { EditorComponentsTypes, SceneCategory } from '../../../lib/sdk/components';
import { SceneAgeRating } from '../../../lib/sdk/components';
import { normalizeAddress } from '../../../lib/logic/ethereum';
import type { Coords } from '../../../lib/utils/layout';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { TransitionMode } from '../../../lib/sdk/components/SceneMetadata';
import { getDataLayerInterface } from '../../../redux/data-layer';
import { normalizePath } from '../../SceneInfoPanel/MarkdownRenderer/utils';
import type { ValidationError } from '../../ImportAsset/types';
import { fromSceneSpawnPoint, toSceneSpawnPoint } from '../PlayerInspector/utils';
import type { SceneInput } from './types';

export function fromScene(value: EditorComponentsTypes['Scene']): SceneInput {
  const parcels = value.layout.parcels.map(parcel => parcel.x + ',' + parcel.y).join(' ');
  return {
    name: value.name || 'My Scene',
    description: value.description || '',
    thumbnail: value.thumbnail || '',
    creator: value.creator || '',
    ageRating: value.ageRating || SceneAgeRating.Adult,
    categories: value.categories || [],
    tags: value.tags ? value.tags.join(', ') : '',
    author: value.author || '',
    email: value.email || '',
    skyboxConfig: {
      fixedTime:
        value.skyboxConfig?.fixedTime !== undefined ? String(value.skyboxConfig.fixedTime) : '',
      transitionMode: String(value.skyboxConfig?.transitionMode ?? TransitionMode.TM_FORWARD),
    },
    silenceVoiceChat: typeof value.silenceVoiceChat === 'boolean' ? value.silenceVoiceChat : false,
    disablePortableExperiences:
      typeof value.disablePortableExperiences === 'boolean'
        ? value.disablePortableExperiences
        : false,
    disableNearbyVoiceChat:
      typeof value.disableNearbyVoiceChat === 'boolean' ? value.disableNearbyVoiceChat : false,
    hideLandscapeTerrain:
      typeof value.hideLandscapeTerrain === 'boolean' ? value.hideLandscapeTerrain : false,
    spawnPoints: Array.isArray(value.spawnPoints)
      ? value.spawnPoints.map(spawnPoint => fromSceneSpawnPoint(spawnPoint))
      : [],
    layout: {
      base: `${value.layout.base.x},${value.layout.base.y}`,
      parcels,
    },
  };
}

export function toScene(inputs: SceneInput): EditorComponentsTypes['Scene'] {
  return {
    name: inputs.name,
    description: inputs.description,
    thumbnail: inputs.thumbnail,
    ageRating: SceneAgeRating.Adult,
    creator: inputs.creator,
    categories: inputs.categories as SceneCategory[],
    tags: inputs.tags.split(',').map(tag => tag.trim()),
    author: inputs.author,
    email: inputs.email,
    skyboxConfig: {
      fixedTime:
        inputs.skyboxConfig.fixedTime !== '' ? Number(inputs.skyboxConfig.fixedTime) : undefined,
      transitionMode: Number(inputs.skyboxConfig.transitionMode) as TransitionMode,
    },
    silenceVoiceChat: inputs.silenceVoiceChat,
    disablePortableExperiences: inputs.disablePortableExperiences,
    disableNearbyVoiceChat: inputs.disableNearbyVoiceChat,
    hideLandscapeTerrain: inputs.hideLandscapeTerrain,
    spawnPoints: inputs.spawnPoints.map(spawnPoint => toSceneSpawnPoint(spawnPoint)),
    layout: {
      base: parseParcels(inputs.layout.base)[0],
      parcels: parseParcels(inputs.layout.parcels),
    },
  };
}

export function parseParcels(value: string): Coords[] {
  const parcels = value.split(' ');
  const coordsList: Coords[] = [];

  for (const parcel of parcels) {
    const coords = parcel.split(',');
    const x = parseInt(coords[0]);
    const y = parseInt(coords[1]);
    if (coords.length !== 2 || isNaN(x) || isNaN(y)) return [];
    coordsList.push({ x, y });
  }

  return coordsList;
}

export function isValidInput(input: SceneInput): boolean {
  const parcels = parseParcels(input.layout.parcels);
  const baseList = parseParcels(input.layout.base);
  return (
    baseList.length === 1 &&
    input.layout.parcels.includes(input.layout.base) &&
    areConnected(parcels)
  );
}

export const isImageFile = (value: string): boolean =>
  ACCEPTED_FILE_TYPES['image'].some(extension => value.endsWith(extension));

export const isImage = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isImageFile(node.name);

export const THUMBNAIL_RECOMMENDED_WIDTH = 1920;
export const THUMBNAIL_RECOMMENDED_HEIGHT = 1080;
const THUMBNAIL_ASPECT_RATIO = THUMBNAIL_RECOMMENDED_WIDTH / THUMBNAIL_RECOMMENDED_HEIGHT;
// A 16:9 thumbnail is not perfectly reproducible at every size once rounded to
// whole pixels (1000x563 is as close as it gets), so allow a 1% deviation.
const THUMBNAIL_ASPECT_TOLERANCE = 0.01;

/**
 * Fraction of the thumbnail's width hidden on EACH side wherever the platform
 * shows the square crop (the central 1080x1080 of a 1920x1080 image). Sizes
 * other than 16:9 get stretched to 16:9 first, so the fraction holds for them too.
 */
export const THUMBNAIL_SAFE_AREA_INSET =
  (THUMBNAIL_RECOMMENDED_WIDTH - THUMBNAIL_RECOMMENDED_HEIGHT) / (2 * THUMBNAIL_RECOMMENDED_WIDTH);

export type ThumbnailDimensions = { width: number; height: number };

export function hasThumbnailAspectRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return (
    Math.abs(width / height - THUMBNAIL_ASPECT_RATIO) <=
    THUMBNAIL_ASPECT_RATIO * THUMBNAIL_ASPECT_TOLERANCE
  );
}

export function getThumbnailWarnings(
  path: string,
  dimensions: ThumbnailDimensions | null,
): string[] {
  const warnings: string[] = [];
  if (!isImageFile(path)) {
    warnings.push('The thumbnail must be a .png or .jpg image.');
  }
  if (dimensions && !hasThumbnailAspectRatio(dimensions.width, dimensions.height)) {
    warnings.push(
      `The thumbnail is ${dimensions.width}×${dimensions.height}, not 16:9, so it may look stretched. ` +
        `Use ${THUMBNAIL_RECOMMENDED_WIDTH}×${THUMBNAIL_RECOMMENDED_HEIGHT} or another 16:9 size.`,
    );
  }
  return warnings;
}

async function getImageDimensions(blob: Blob): Promise<ThumbnailDimensions> {
  const bitmap = await createImageBitmap(blob);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export async function validateThumbnailFile(blob: Blob): Promise<ValidationError> {
  let dimensions: ThumbnailDimensions;
  try {
    dimensions = await getImageDimensions(blob);
  } catch {
    return { type: 'dimensions', message: 'The file could not be read as an image.' };
  }
  if (hasThumbnailAspectRatio(dimensions.width, dimensions.height)) return undefined;
  return {
    type: 'dimensions',
    message:
      `${dimensions.width}×${dimensions.height} is not a supported thumbnail size. ` +
      `Use a 16:9 image, ideally ${THUMBNAIL_RECOMMENDED_WIDTH}×${THUMBNAIL_RECOMMENDED_HEIGHT}.`,
  };
}

/**
 * Checks an existing scene file before it is set as the thumbnail. A file that
 * cannot be read is a broken reference rather than a bad image, so it is let
 * through and the preview reports it instead.
 */
export async function validateThumbnailPath(path: string): Promise<ValidationError> {
  if (!path) return undefined;
  const dataLayer = getDataLayerInterface();
  if (!dataLayer) return undefined;
  let content: Uint8Array;
  try {
    ({ content } = await dataLayer.getFile({ path: normalizePath(path) }));
  } catch {
    return undefined;
  }
  return validateThumbnailFile(new Blob([content as BlobPart]));
}

export const MIDDAY_SECONDS = 43200;
export const MIDNIGHT_SECONDS = 86400;

/**
 * The component patch a Multiplayer Server toggle produces, and whether the host
 * must install the authoritative-server SDK first.
 */
export function nextMultiplayerValue(
  enabled: boolean,
  authServerSupported: boolean,
): { install: boolean; patch: Partial<EditorComponentsTypes['Scene']> | null } {
  if (!enabled) {
    return { install: false, patch: { multiplayerServer: false } };
  }
  if (authServerSupported) return { install: false, patch: { multiplayerServer: true } };
  return { install: true, patch: null };
}

/** One entry per distinct address, in stored order and stored spelling, blanks dropped. */
export const dedupeAddresses = (stored: string[] = []): string[] => {
  const seen = new Set<string>();
  return stored.filter(address => {
    if (!address) return false;
    const key = normalizeAddress(address);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Whether `address` is already stored, under any spelling. */
export const containsAddress = (stored: string[] = [], address: string): boolean =>
  stored.some(entry => normalizeAddress(entry) === normalizeAddress(address));

/** Every stored entry that is not `address`, under any spelling. */
export const withoutAddress = (stored: string[] = [], address: string): string[] =>
  stored.filter(entry => normalizeAddress(entry) !== normalizeAddress(address));
