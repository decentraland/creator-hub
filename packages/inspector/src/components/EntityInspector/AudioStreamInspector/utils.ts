import type { PBAudioStream } from '@dcl/ecs';

import { isValidHttpsUrl } from '../../../lib/utils/url';
import type { EntityValidator } from '../../../lib/sdk/validation/types';
import type { AudioStreamInput } from './types';

export const fromAudioStream = (value: PBAudioStream): AudioStreamInput => {
  return {
    url: value.url,
    playing: value.playing,
    volume: volumeFromAudioStream(value.volume),
  };
};

export const toAudioStream = (value: AudioStreamInput): PBAudioStream => {
  return {
    url: value.url,
    playing: value.playing,
    volume: volumeToAudioStream(value.volume),
  };
};

export function volumeFromAudioStream(volume: number | undefined): string {
  const value = (volume ?? 1.0) * 100;
  return parseInt(value.toFixed(2)).toString();
}

export function volumeToAudioStream(volume: string | undefined): number {
  const value = parseFloat(volume ?? '0');
  return parseFloat((value / 100).toFixed(2));
}

export function isValidInput(url: string): boolean {
  return isValidHttpsUrl(url);
}

export const entityValidator: EntityValidator = (sdk, entity) => {
  const audioStream = sdk.components.AudioStream.getOrNull(entity);
  if (audioStream && !isValidInput(audioStream.url)) return false;
  return true;
};

export function isValidVolume(volume: string | undefined): boolean {
  const value = (volume ?? 0).toString();
  return !isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= 100;
}
