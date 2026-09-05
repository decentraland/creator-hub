import type { Entity } from '@dcl/ecs';

export interface Props {
  entities: Entity[];
  initialOpen?: boolean;
}

export type AudioSourceInput = {
  audioClipUrl: string;
  playing?: boolean;
  loop?: boolean;
  volume?: string;
  pitch?: string;
  global?: boolean;
  // Hidden pass-through (no UI control): playback-position seek, only meaningful at runtime.
  // Carried through the input so edits from the inspector never delete it.
  currentTime?: string;
};
