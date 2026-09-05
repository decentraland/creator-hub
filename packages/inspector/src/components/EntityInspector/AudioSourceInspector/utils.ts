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
    pitch: pitchFromAudioSource(value.pitch),
    global: value.global,
    currentTime: currentTimeFromAudioSource(value.currentTime),
  };
};

export const toAudioSource = (value: AudioSourceInput): PBAudioSource => {
  return {
    audioClipUrl: value.audioClipUrl,
    loop: value.loop,
    playing: value.playing,
    volume: volumeToAudioSource(value.volume),
    pitch: pitchToAudioSource(value.pitch),
    global: value.global,
    currentTime: currentTimeToAudioSource(value.currentTime),
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

export function pitchFromAudioSource(pitch: number | undefined): string {
  return (pitch ?? 1).toString();
}

export function pitchToAudioSource(pitch: string | undefined): number {
  const value = parseFloat(pitch ?? '1');
  return isNaN(value) ? 1 : value;
}

export function currentTimeFromAudioSource(currentTime: number | undefined): string | undefined {
  return currentTime === undefined ? undefined : currentTime.toString();
}

export function currentTimeToAudioSource(currentTime: string | undefined): number | undefined {
  if (currentTime === undefined || currentTime === '') return undefined;
  const value = parseFloat(currentTime);
  return isNaN(value) ? undefined : value;
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

export function isValidPitch(pitch: string | undefined): boolean {
  const value = (pitch ?? 0).toString();
  return !isNaN(parseFloat(value)) && parseFloat(value) > 0;
}
