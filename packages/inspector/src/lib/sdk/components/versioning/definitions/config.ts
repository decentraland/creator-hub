import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';
import { BaseComponentNames } from '../base-names';

const CONFIG_BASE_NAME = BaseComponentNames.CONFIG;

enum TransformOnError {
  FAIL = 'fail',
  SKIP = 'skip',
  NOOP = 'noop',
}

const ConfigV0 = {
  isBasicViewEnabled: Schemas.Boolean,
  // @deprecated - Legacy property for backward compatibility
  componentName: Schemas.String,
  // @deprecated - Legacy property for backward compatibility
  fields: Schemas.Array(
    Schemas.Map({
      name: Schemas.String,
      type: Schemas.String, // Using String instead of EnumString to avoid circular dependency
      layout: Schemas.Optional(Schemas.String),
      basicViewId: Schemas.Optional(Schemas.String),
    }),
  ),
  // @deprecated - Legacy property for backward compatibility
  assetId: Schemas.Optional(Schemas.String),

  // V2 properties
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
            // Additional props for the widget, we should make all of them optional
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
                // [key: string]: unknown // TODO: Define a better dataSource schema to get data from components or other sources
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
};

export const CONFIG_VERSIONS = [{ versionName: CONFIG_BASE_NAME, component: ConfigV0 }];

export function defineConfigComponent(engine: IEngine) {
  return engine.defineComponent(CONFIG_BASE_NAME, ConfigV0);
}

export type ConfigComponentType = MapResult<typeof ConfigV0>;
