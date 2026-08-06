import type { PBVideoPlayer } from '@dcl/ecs';

import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import { isValidHttpsUrl } from '../../../lib/utils/url';
import type { VideoPlayerInput } from './types';

export const fromVideoPlayer = (value: PBVideoPlayer): VideoPlayerInput => {
  return {
    src: value.src,
    loop: value.loop,
    playing: value.playing,
    volume: volumeFromVideoPlayer(value.volume),
    position: numberFromVideoPlayer(value.position),
    playbackRate: numberFromVideoPlayer(value.playbackRate),
    spatial: value.spatial,
    spatialMinDistance: numberFromVideoPlayer(value.spatialMinDistance),
    spatialMaxDistance: numberFromVideoPlayer(value.spatialMaxDistance),
  };
};

export const toVideoPlayer = (value: VideoPlayerInput): PBVideoPlayer => {
  return {
    src: value.src,
    loop: value.loop,
    playing: value.playing,
    volume: volumeToVideoPlayer(value.volume),
    position: numberToVideoPlayer(value.position),
    playbackRate: numberToVideoPlayer(value.playbackRate),
    spatial: value.spatial,
    spatialMinDistance: numberToVideoPlayer(value.spatialMinDistance),
    spatialMaxDistance: numberToVideoPlayer(value.spatialMaxDistance),
  };
};

// PBVideoPlayer numeric fields are proto3 `optional`: unset and 0 are distinct on the wire,
// so an unset field must stay unset through the input round trip (empty string ⇔ undefined).
export function numberFromVideoPlayer(value: number | undefined): string | undefined {
  return value === undefined ? undefined : value.toString();
}

export function numberToVideoPlayer(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

export function volumeFromVideoPlayer(volume: number | undefined): string {
  const value = (volume ?? 1.0) * 100;
  return parseInt(value.toFixed(2)).toString();
}

export function volumeToVideoPlayer(volume: string | undefined): number {
  const value = parseFloat(volume ?? '0');
  return parseFloat((value / 100).toFixed(2));
}

export function isValidInput({ basePath, assets }: AssetCatalogResponse, src: string): boolean {
  // Allow empty strings (optional field)
  if (!src) return true;
  return (
    isValidHttpsUrl(src) || !!assets.find($ => (basePath ? basePath + '/' + src : src) === $.path)
  );
}

export const isVideoFile = (value: string): boolean => value.endsWith('.mp4');
export const isVideo = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isVideoFile(node.name);

export function isValidVolume(volume: string | undefined): boolean {
  const value = (volume ?? 0).toString();
  return !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100;
}

export function isValidPlaybackRate(rate: string | undefined): boolean {
  if (!rate) return true; // empty means "unset" (engine default: 1)
  return !isNaN(parseFloat(rate)) && parseFloat(rate) > 0;
}

export function isValidPosition(position: string | undefined): boolean {
  if (!position) return true; // empty means "unset" (engine default: 0)
  return !isNaN(parseFloat(position)) && parseFloat(position) >= 0;
}

export function isValidSpatialDistance(distance: string | undefined): boolean {
  if (!distance) return true; // empty means "unset" (engine defaults: min 0, max 60)
  return !isNaN(parseFloat(distance)) && parseFloat(distance) >= 0;
}
