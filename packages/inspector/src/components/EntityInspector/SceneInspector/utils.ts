import { areConnected } from '@dcl/ecs';
import type { EditorComponentsTypes, SceneCategory } from '../../../lib/sdk/components';
import { SceneAgeRating } from '../../../lib/sdk/components';
import type { Coords } from '../../../lib/utils/layout';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { TransitionMode } from '../../../lib/sdk/components/SceneMetadata';
import { fromSceneSpawnPoint, toSceneSpawnPoint } from '../PlayerInspector/utils';
import type { SceneInput } from './types';

export function fromScene(value: EditorComponentsTypes['Scene']): SceneInput {
  const parcels = value.layout.parcels.map(parcel => parcel.x + ',' + parcel.y).join(' ');
  return {
    name: value.name || 'My Scene',
    description: value.description || '',
    thumbnail: value.thumbnail || '',
    creator: value.creator || '',
    ageRating: value.ageRating || SceneAgeRating.Teen,
    categories: value.categories || [],
    tags: value.tags ? value.tags.join(', ') : '',
    author: value.author || '',
    email: value.email || '',
    skyboxConfig: {
      fixedTime: String(value.skyboxConfig?.fixedTime ?? MIDDAY_SECONDS),
      transitionMode: String(value.skyboxConfig?.transitionMode ?? TransitionMode.TM_FORWARD),
    },
    silenceVoiceChat: typeof value.silenceVoiceChat === 'boolean' ? value.silenceVoiceChat : false,
    disablePortableExperiences:
      typeof value.disablePortableExperiences === 'boolean'
        ? value.disablePortableExperiences
        : false,
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
    ageRating: inputs.ageRating as SceneAgeRating,
    creator: inputs.creator,
    categories: inputs.categories as SceneCategory[],
    tags: inputs.tags.split(',').map(tag => tag.trim()),
    author: inputs.author,
    email: inputs.email,
    skyboxConfig: {
      fixedTime: Number(inputs.skyboxConfig.fixedTime ?? MIDDAY_SECONDS),
      transitionMode: Number(inputs.skyboxConfig.transitionMode) as TransitionMode,
    },
    silenceVoiceChat: inputs.silenceVoiceChat,
    disablePortableExperiences: inputs.disablePortableExperiences,
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

export const MIDDAY_SECONDS = 43200;
export const MIDNIGHT_SECONDS = 86400;
