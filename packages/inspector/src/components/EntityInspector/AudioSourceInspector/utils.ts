import type { PBAudioSource } from '@dcl/ecs';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import type { AudioSourceInput } from './types';

export const fromAudioSource = (value: PBAudioSource): AudioSourceInput => {
  return {
    audioClipUrl: value.audioClipUrl,
    loop: value.loop,
    playing: value.playing,
    volume: volumeFromAudioSource(value.volume),
    global: value.global,
  };
};

export const toAudioSource = (value: AudioSourceInput): PBAudioSource => {
  return {
    audioClipUrl: value.audioClipUrl,
    loop: value.loop,
    playing: value.playing,
    volume: volumeToAudioSource(value.volume),
    global: value.global,
  };
};

export function volumeFromAudioSource(volume: number | undefined): string {
  const value = (volume ?? 1.0) * 100;
  return parseInt(value.toFixed(2)).toString();
}

export function volumeToAudioSource(volume: string | undefined): number {
  const value = parseFloat(volume ?? '0');
  return parseFloat((value / 100).toFixed(2));
}

export function isValidInput({ assets }: AssetCatalogResponse, src: string): boolean {
  // Allow empty strings (optional field)
  if (!src || src === '--') return true;
  // FileUploadField always sends paths with basePath included
  return !!assets.find($ => src === $.path);
}

export const isAudioFile = (value: string): boolean =>
  value.endsWith('.mp3') || value.endsWith('.ogg') || value.endsWith('.wav');

export const isAudio = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isAudioFile(node.name);

export function isValidVolume(volume: string | undefined): boolean {
  const value = (volume ?? 0).toString();
  return !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100;
}
