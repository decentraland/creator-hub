import { Schemas } from '@dcl/ecs';
import { AdminPermissions, MediaSource } from '../constants';
import { TriggerType, TriggerConditionType, TriggerConditionOperation } from '../trigger-enums';
import { VariableType } from '../variable-enums';
import { SegmentKind } from '../segment-enums';
import { createComponentFramework, type VersionedComponents } from './framework';

const COMPONENT_REGISTRY = {
  'asset-packs::ActionTypes': [
    {
      value: Schemas.Array(
        Schemas.Map({
          type: Schemas.String,
          jsonSchema: Schemas.String,
        }),
      ),
    },
  ],
  'asset-packs::Actions': [
    {
      id: Schemas.Int,
      value: Schemas.Array(
        Schemas.Map({
          name: Schemas.String,
          type: Schemas.String,
          jsonPayload: Schemas.String,
          allowedInBasicView: Schemas.Optional(Schemas.Boolean),
          basicViewId: Schemas.Optional(Schemas.String),
          default: Schemas.Optional(Schemas.Boolean),
        }),
      ),
    },
  ],
  'asset-packs::Counter': [
    {
      id: Schemas.Number,
      value: Schemas.Int,
    },
  ],
  'asset-packs::Triggers': [
    {
      value: Schemas.Array(
        Schemas.Map({
          type: Schemas.EnumString<TriggerType>(TriggerType, TriggerType.ON_INPUT_ACTION),
          conditions: Schemas.Optional(
            Schemas.Array(
              Schemas.Map({
                id: Schemas.Optional(Schemas.Int),
                type: Schemas.EnumString<TriggerConditionType>(
                  TriggerConditionType,
                  TriggerConditionType.WHEN_STATE_IS,
                ),
                value: Schemas.String,
              }),
            ),
          ),
          operation: Schemas.Optional(
            Schemas.EnumString<TriggerConditionOperation>(
              TriggerConditionOperation,
              TriggerConditionOperation.AND,
            ),
          ),
          actions: Schemas.Array(
            Schemas.Map({
              id: Schemas.Optional(Schemas.Int),
              name: Schemas.Optional(Schemas.String),
            }),
          ),
          basicViewId: Schemas.Optional(Schemas.String),
        }),
      ),
    },
  ],
  'asset-packs::States': [
    {
      id: Schemas.Number,
      value: Schemas.Array(Schemas.String),
      defaultValue: Schemas.Optional(Schemas.String),
      currentValue: Schemas.Optional(Schemas.String),
      previousValue: Schemas.Optional(Schemas.String),
    },
  ],
  'asset-packs::CounterBar': [
    {
      primaryColor: Schemas.Optional(Schemas.String),
      secondaryColor: Schemas.Optional(Schemas.String),
      maxValue: Schemas.Optional(Schemas.Float),
    },
  ],
  'asset-packs::AdminTools': [
    {
      adminPermissions: Schemas.EnumString<AdminPermissions>(
        AdminPermissions,
        AdminPermissions.PUBLIC,
      ),
      authorizedAdminUsers: Schemas.Map({
        me: Schemas.Boolean,
        sceneOwners: Schemas.Boolean,
        allowList: Schemas.Boolean,
        adminAllowList: Schemas.Array(Schemas.String),
      }),
      moderationControl: Schemas.Map({
        isEnabled: Schemas.Boolean,
        kickCoordinates: Schemas.Map({
          x: Schemas.Number,
          y: Schemas.Number,
          z: Schemas.Number,
        }),
        allowNonOwnersManageAdminAllowList: Schemas.Boolean,
      }),
      textAnnouncementControl: Schemas.Map({
        isEnabled: Schemas.Boolean,
        playSoundOnEachAnnouncement: Schemas.Boolean,
        showAuthorOnEachAnnouncement: Schemas.Boolean,
      }),
      videoControl: Schemas.Map({
        isEnabled: Schemas.Boolean,
        disableVideoPlayersSound: Schemas.Boolean,
        showAuthorOnVideoPlayers: Schemas.Boolean,
        linkAllVideoPlayers: Schemas.Boolean,
        videoPlayers: Schemas.Optional(
          Schemas.Array(
            Schemas.Map({
              entity: Schemas.Int,
              customName: Schemas.String,
            }),
          ),
        ),
      }),
      smartItemsControl: Schemas.Map({
        isEnabled: Schemas.Boolean,
        linkAllSmartItems: Schemas.Boolean,
        smartItems: Schemas.Optional(
          Schemas.Array(
            Schemas.Map({
              entity: Schemas.Int,
              customName: Schemas.String,
              defaultAction: Schemas.String,
            }),
          ),
        ),
      }),
      rewardsControl: Schemas.Map({
        isEnabled: Schemas.Boolean,
        rewardItems: Schemas.Optional(
          Schemas.Array(
            Schemas.Map({
              entity: Schemas.Int,
              customName: Schemas.String,
            }),
          ),
        ),
      }),
    },
  ],
  'asset-packs::VideoScreen': [
    {
      thumbnail: Schemas.String,
      defaultMediaSource: Schemas.EnumNumber<MediaSource>(MediaSource, MediaSource.VideoURL),
      defaultURL: Schemas.String,
    },
  ],
  'asset-packs::Rewards': [
    {
      campaignId: Schemas.String,
      dispenserKey: Schemas.String,
      testMode: Schemas.Boolean,
    },
  ],
  'asset-packs::TextAnnouncements': [
    {
      text: Schemas.String,
      author: Schemas.Optional(Schemas.String),
      id: Schemas.String,
    },
  ],
  'asset-packs::VideoControlState': [
    {
      endsAt: Schemas.Optional(Schemas.Int64),
      /** @deprecated streamKey is deprecated and will be removed in a future version */
      streamKey: Schemas.Optional(Schemas.String),
    },
  ],
  'asset-packs::Script': [
    {
      value: Schemas.Array(
        Schemas.Map({
          path: Schemas.String,
          priority: Schemas.Number,
          layout: Schemas.Optional(Schemas.String),
        }),
      ),
    },
  ],
  'asset-packs::Placeholder': [
    {
      src: Schemas.String,
    },
  ],
  'asset-packs::UI': [
    {
      name: Schemas.String,
      visible: Schemas.Boolean,
      // Design/virtual resolution (px) the UI is authored against. At runtime
      // it is passed to addUiRenderer as virtualWidth/virtualHeight so the UI
      // scales to fit the player's screen. 0 → fall back to 1920×1080.
      canvasWidth: Schemas.Number,
      canvasHeight: Schemas.Number,
      variables: Schemas.Array(
        Schemas.Map({
          name: Schemas.String,
          type: Schemas.EnumString<VariableType>(VariableType, VariableType.STRING),
          defaultValue: Schemas.String,
        }),
      ),
    },
  ],
  'asset-packs::UIBindings': [
    {
      value: Schemas.Array(
        Schemas.Map({
          field: Schemas.String,
          variable: Schemas.String,
          segments: Schemas.Optional(
            Schemas.Array(
              Schemas.Map({
                kind: Schemas.EnumString<SegmentKind>(SegmentKind, SegmentKind.LITERAL),
                value: Schemas.String,
              }),
            ),
          ),
        }),
      ),
    },
  ],
  'asset-packs::UIDesign': [
    {
      // Sibling-order + parent links of the node. Entity-typed so the composite
      // loader remaps them into the scene's entity range on load; the runtime sets
      // core::UiTransform.parent/rightOf from these (see Phase 2).
      parent: Schemas.Entity,
      rightOf: Schemas.Entity,
      // The remaining core::UiTransform fields (everything EXCEPT parent/rightOf),
      // JSON-encoded. Lossless + resilient to PBUiTransform additions; no entity refs.
      transform: Schemas.String,
      // JSON-encoded core::UiText / UiInput / UiDropdown / UiBackground design. Absent on
      // nodes that don't carry the corresponding render component. Background is folded in
      // here (not kept as a separate verbatim core::UiBackground) so the runtime re-derives
      // it every tick like the other render components — see ui-runtime.ts:materializeBackground.
      text: Schemas.Optional(Schemas.String),
      input: Schemas.Optional(Schemas.String),
      dropdown: Schemas.Optional(Schemas.String),
      background: Schemas.Optional(Schemas.String),
    },
  ],
} as const;

export type AssetPacksVersionedComponents = VersionedComponents<typeof COMPONENT_REGISTRY>;

export const { VERSIONS_REGISTRY, getLatestVersionName, defineAllComponents, migrateAll } =
  createComponentFramework(COMPONENT_REGISTRY);

export { COMPONENT_REGISTRY };
