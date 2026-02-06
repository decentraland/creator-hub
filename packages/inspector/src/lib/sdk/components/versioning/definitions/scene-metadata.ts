import { Schemas } from '@dcl/ecs';

export enum SceneAgeRating {
  Teen = 'T',
  Adult = 'A',
}

export enum SceneCategory {
  ART = 'art',
  GAME = 'game',
  CASINO = 'casino',
  SOCIAL = 'social',
  MUSIC = 'music',
  FASHION = 'fashion',
  CRYPTO = 'crypto',
  EDUCATION = 'education',
  SHOP = 'shop',
  BUSINESS = 'business',
  SPORTS = 'sports',
}

export const Coords = Schemas.Map({
  x: Schemas.Int,
  y: Schemas.Int,
});

export enum TransitionMode {
  TM_FORWARD = 0,
  TM_BACKWARD = 1,
}
