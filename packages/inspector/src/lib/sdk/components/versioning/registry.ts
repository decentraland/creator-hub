import { Schemas } from '@dcl/ecs';
import { createComponentFramework } from '@dcl/asset-packs';
import {
  SceneAgeRating,
  SceneCategory,
  Coords,
  TransitionMode,
} from './definitions/scene-metadata';
import { TransformOnError } from './definitions/config';

const COMPONENT_REGISTRY = {
  'inspector::Selection': [{ gizmo: Schemas.Int }],
  'inspector::Nodes': [
    {
      value: Schemas.Array(
        Schemas.Map({
          entity: Schemas.Entity,
          open: Schemas.Optional(Schemas.Boolean),
          children: Schemas.Array(Schemas.Entity),
        }),
      ),
    },
  ],
  'inspector::TransformConfig': [{ porportionalScaling: Schemas.Optional(Schemas.Boolean) }],
  'inspector::Hide': [{ value: Schemas.Boolean }],
  'inspector::Lock': [{ value: Schemas.Boolean }],
  // eslint-disable-next-line @typescript-eslint/ban-types
  'inspector::Ground': [{}],
  // eslint-disable-next-line @typescript-eslint/ban-types
  'inspector::Tile': [{}],
  'inspector::CustomAsset': [{ assetId: Schemas.String }],
  'inspector::Config': [
    {
      isBasicViewEnabled: Schemas.Boolean,
      // @deprecated - Legacy property for backward compatibility
      componentName: Schemas.String,
      // @deprecated - Legacy property for backward compatibility
      fields: Schemas.Array(
        Schemas.Map({
          name: Schemas.String,
          type: Schemas.String,
          layout: Schemas.Optional(Schemas.String),
          basicViewId: Schemas.Optional(Schemas.String),
        }),
      ),
      // @deprecated - Legacy property for backward compatibility
      assetId: Schemas.Optional(Schemas.String),
      label: Schemas.Optional(Schemas.String),
      sections: Schemas.Optional(
        Schemas.Array(
          Schemas.Map({
            id: Schemas.String,
            label: Schemas.Optional(Schemas.String),
            items: Schemas.Array(
              Schemas.Map({
                component: Schemas.String,
                widget: Schemas.String,
                label: Schemas.Optional(Schemas.String),
                type: Schemas.Optional(Schemas.String),
                path: Schemas.Optional(Schemas.String),
                basicViewId: Schemas.Optional(Schemas.String),
                props: Schemas.Optional(
                  Schemas.Map({
                    basic: Schemas.Optional(Schemas.Boolean),
                  }),
                ),
                constraints: Schemas.Optional(
                  Schemas.Map({
                    min: Schemas.Optional(Schemas.Number),
                    max: Schemas.Optional(Schemas.Number),
                    minExclusive: Schemas.Optional(Schemas.Number),
                    maxExclusive: Schemas.Optional(Schemas.Number),
                    step: Schemas.Optional(Schemas.Number),
                    multipleOf: Schemas.Optional(Schemas.Number),
                    minLength: Schemas.Optional(Schemas.Number),
                    maxLength: Schemas.Optional(Schemas.Number),
                    pattern: Schemas.Optional(Schemas.String),
                    format: Schemas.Optional(Schemas.String),
                    default: Schemas.Optional(Schemas.String),
                  }),
                ),
                transform: Schemas.Optional(
                  Schemas.Map({
                    in: Schemas.Optional(
                      Schemas.Map({
                        steps: Schemas.Array(
                          Schemas.Map({
                            op: Schemas.String,
                            onError: Schemas.Optional(
                              Schemas.EnumString<TransformOnError>(
                                TransformOnError,
                                TransformOnError.NOOP,
                              ),
                            ),
                          }),
                        ),
                      }),
                    ),
                    out: Schemas.Optional(
                      Schemas.Map({
                        steps: Schemas.Array(
                          Schemas.Map({
                            op: Schemas.String,
                            onError: Schemas.Optional(
                              Schemas.EnumString<TransformOnError>(
                                TransformOnError,
                                TransformOnError.NOOP,
                              ),
                            ),
                          }),
                        ),
                      }),
                    ),
                  }),
                ),
                dataSource: Schemas.Optional(
                  Schemas.Map({
                    kind: Schemas.String,
                  }),
                ),
              }),
            ),
            columns: Schemas.Optional(Schemas.Number),
            helpTooltip: Schemas.Optional(
              Schemas.Map({
                text: Schemas.String,
                link: Schemas.Optional(Schemas.String),
              }),
            ),
          }),
        ),
      ),
      helpTooltip: Schemas.Optional(
        Schemas.Map({
          text: Schemas.String,
          link: Schemas.Optional(Schemas.String),
        }),
      ),
      version: Schemas.Optional(Schemas.Number),
    },
  ],
  'inspector::UIState': [{ sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean) }],
  'inspector::SceneMetadata': [
    // V0 - Original version
    {
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
    },
    // V1 - Added skyboxConfig
    {
      skyboxConfig: Schemas.Optional(
        Schemas.Map({
          fixedTime: Schemas.Optional(Schemas.Int),
          transitionMode: Schemas.Optional(
            Schemas.EnumNumber(TransitionMode, TransitionMode.TM_FORWARD),
          ),
        }),
      ),
    },
    // V2 - Added creator
    {
      creator: Schemas.Optional(Schemas.String),
    },
  ],
} as const;

export type InspectorComponentRegistry = typeof COMPONENT_REGISTRY;

export const { VERSIONS_REGISTRY, getLatestVersionName, defineAllComponents, migrateAll } =
  createComponentFramework(COMPONENT_REGISTRY);

export { COMPONENT_REGISTRY };
