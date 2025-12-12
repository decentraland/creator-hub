import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type SpawnPointInput = {
  position: {
    x: number;
    y: number;
    z: number;
  };
  randomOffset: boolean;
  maxOffset: number;
  cameraTarget: {
    x: number;
    y: number;
    z: number;
  };
};

export type SceneInput = {
  creator: string;
  name: string;
  description: string;
  skyboxConfig: {
    fixedTime: string;
    transitionMode: string;
  };
  thumbnail: string;
  ageRating: string;
  categories: string[];
  tags: string;
  author: string;
  email: string;
  silenceVoiceChat: boolean;
  disablePortableExperiences: boolean;
  spawnPoints: SpawnPointInput[];
  layout: {
    base: string;
    parcels: string;
  };
};
