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

// SceneMetadata component versions
// Each element in the array represents a version of the component

// V0 - Original version
const SceneMetadataV0 = {
  name: Schemas.Optional(Schemas.String),
  description: Schemas.Optional(Schemas.String),
  thumbnail: Schemas.Optional(Schemas.String),
  ageRating: Schemas.Optional(Schemas.EnumString(SceneAgeRating, SceneAgeRating.Teen)),
  categories: Schemas.Optional(
    Schemas.Array(Schemas.EnumString(SceneCategory, SceneCategory.GAME)),
  ),
  author: Schemas.Optional(Schemas.String),
  email: Schemas.Optional(Schemas.String),
  tags: Schemas.Optional(Schemas.Array(Schemas.String)),
  layout: Schemas.Map({
    base: Coords,
    parcels: Schemas.Array(Coords),
  }),
  silenceVoiceChat: Schemas.Optional(Schemas.Boolean),
  disablePortableExperiences: Schemas.Optional(Schemas.Boolean),
  spawnPoints: Schemas.Optional(
    Schemas.Array(
      Schemas.Map({
        name: Schemas.String,
        default: Schemas.Optional(Schemas.Boolean),
        position: Schemas.Map({
          x: Schemas.OneOf({
            single: Schemas.Int,
            range: Schemas.Array(Schemas.Int),
          }),
          y: Schemas.OneOf({
            single: Schemas.Int,
            range: Schemas.Array(Schemas.Int),
          }),
          z: Schemas.OneOf({
            single: Schemas.Int,
            range: Schemas.Array(Schemas.Int),
          }),
        }),
        cameraTarget: Schemas.Optional(
          Schemas.Map({
            x: Schemas.Int,
            y: Schemas.Int,
            z: Schemas.Int,
          }),
        ),
      }),
    ),
  ),
};

// V1 - Added skyboxConfig
const SceneMetadataV1 = {
  ...SceneMetadataV0,
  skyboxConfig: Schemas.Optional(
    Schemas.Map({
      fixedTime: Schemas.Optional(Schemas.Int),
      transitionMode: Schemas.Optional(
        Schemas.EnumNumber(TransitionMode, TransitionMode.TM_FORWARD),
      ),
    }),
  ),
};

// V2 - Added creator
const SceneMetadataV2 = {
  ...SceneMetadataV1,
  creator: Schemas.Optional(Schemas.String),
};

export const SCENE_METADATA_VERSIONS = [SceneMetadataV0, SceneMetadataV1, SceneMetadataV2] as const;
