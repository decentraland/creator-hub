import type {
  Entity,
  IEngine,
  ISchema,
  MaterialComponentDefinitionExtended,
  PBMaterial,
  PBVideoPlayer,
  PBMainCamera,
  PBVirtualCamera,
  VideoTexture,
  AnimatorComponentDefinitionExtended,
  TransformComponentExtended,
  LastWriteWinElementSetComponentDefinition,
  PBAvatarAttach,
  PBVisibilityComponent,
  PBGltfContainer,
  PBUiTransform,
  PBUiText,
  PBTextShape,
  PBUiBackground,
  MeshRendererComponentDefinitionExtended,
  PBBillboard,
  NameType,
  PBTween,
  PBTweenSequence,
  PBPointerEvents,
  PBLightSource,
  NetworkEntity,
  SyncComponents,
  AudioSourceComponentDefinitionExtended,
  PBUiInput,
  PBUiInputResult,
  PBUiCanvasInformation,
  InputModifierComponentDefinitionExtended,
} from '@dcl/ecs';
import { Schemas } from '@dcl/ecs';
import { addActionType } from './action-types';
import {
  ComponentName,
  TweenType,
  InterpolationType,
  ActionType,
  TriggerType,
  TriggerConditionType,
  TriggerConditionOperation,
  AlignMode,
  Font,
  Colliders,
  ProximityLayer,
  AdminPermissions,
  MediaSource,
  TextureMovementType,
} from './enums';
import { getExplorerComponents } from './components';

export const LIVEKIT_STREAM_SRC = 'livekit-video://current-stream';
export const VIDEO_URL_TYPE = 'https://';

export * from './enums';
export * from './action-types';
export * from './events';
export * from './id';
export * from './states';
export * from './clone';
export * from './lww';
export * from './types';

export const ActionSchemas = {
  [ActionType.PLAY_ANIMATION]: Schemas.Map({
    animation: Schemas.String,
    loop: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.STOP_ANIMATION]: Schemas.Map({}),
  [ActionType.SET_STATE]: Schemas.Map({ state: Schemas.String }),
  [ActionType.START_TWEEN]: Schemas.Map({
    type: Schemas.EnumString<TweenType>(TweenType, TweenType.MOVE_ITEM),
    end: Schemas.Vector3,
    interpolationType: Schemas.EnumString(InterpolationType, InterpolationType.LINEAR),
    duration: Schemas.Float,
    relative: Schemas.Boolean,
    // For KEEP_ROTATING_ITEM
    direction: Schemas.Optional(Schemas.Vector3),
    speed: Schemas.Optional(Schemas.Float),
  }),
  [ActionType.SET_COUNTER]: Schemas.Map({ counter: Schemas.Int }),
  [ActionType.INCREMENT_COUNTER]: Schemas.Map({
    amount: Schemas.Optional(Schemas.Int),
  }),
  [ActionType.DECREASE_COUNTER]: Schemas.Map({
    amount: Schemas.Optional(Schemas.Int),
  }),
  [ActionType.PLAY_SOUND]: Schemas.Map({
    src: Schemas.String,
    loop: Schemas.Optional(Schemas.Boolean),
    volume: Schemas.Optional(Schemas.Float),
    global: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.STOP_SOUND]: Schemas.Map({}),
  [ActionType.SET_VISIBILITY]: Schemas.Map({
    visible: Schemas.Boolean,
    /** @deprecated use collider instead */
    physicsCollider: Schemas.Optional(Schemas.Boolean),
    collider: Schemas.Optional(Schemas.EnumNumber(Colliders, Colliders.CL_POINTER)),
  }),
  [ActionType.ATTACH_TO_PLAYER]: Schemas.Map({
    anchorPointId: Schemas.Int,
  }),
  [ActionType.DETACH_FROM_PLAYER]: Schemas.Map({}),
  [ActionType.PLAY_VIDEO_STREAM]: Schemas.Map({
    src: Schemas.Optional(Schemas.String),
    loop: Schemas.Optional(Schemas.Boolean),
    volume: Schemas.Optional(Schemas.Float),
    dclCast: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.STOP_VIDEO_STREAM]: Schemas.Map({}),
  [ActionType.PLAY_AUDIO_STREAM]: Schemas.Map({
    url: Schemas.String,
    volume: Schemas.Optional(Schemas.Float),
  }),
  [ActionType.STOP_AUDIO_STREAM]: Schemas.Map({}),
  [ActionType.TELEPORT_PLAYER]: Schemas.Map({
    x: Schemas.Int,
    y: Schemas.Int,
  }),
  [ActionType.MOVE_PLAYER]: Schemas.Map({
    position: Schemas.Vector3,
    cameraTarget: Schemas.Optional(Schemas.Vector3),
  }),
  [ActionType.PLAY_DEFAULT_EMOTE]: Schemas.Map({
    emote: Schemas.String,
  }),
  [ActionType.PLAY_CUSTOM_EMOTE]: Schemas.Map({
    src: Schemas.String,
    loop: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.OPEN_LINK]: Schemas.Map({
    url: Schemas.String,
  }),
  [ActionType.SHOW_TEXT]: Schemas.Map({
    text: Schemas.String,
    hideAfterSeconds: Schemas.Float,
    font: Schemas.EnumNumber(Font, Font.F_SANS_SERIF),
    fontSize: Schemas.Optional(Schemas.Float),
    textAlign: Schemas.EnumNumber(AlignMode, AlignMode.TAM_MIDDLE_CENTER),
  }),
  [ActionType.HIDE_TEXT]: Schemas.Map({}),
  [ActionType.START_DELAY]: Schemas.Map({
    actions: Schemas.Array(Schemas.String),
    timeout: Schemas.Float,
  }),
  [ActionType.STOP_DELAY]: Schemas.Map({
    action: Schemas.String,
  }),
  [ActionType.START_LOOP]: Schemas.Map({
    actions: Schemas.Array(Schemas.String),
    interval: Schemas.Float,
  }),
  [ActionType.STOP_LOOP]: Schemas.Map({
    action: Schemas.String,
  }),
  [ActionType.CLONE_ENTITY]: Schemas.Map({
    position: Schemas.Vector3,
  }),
  [ActionType.REMOVE_ENTITY]: Schemas.Map({}),
  [ActionType.SHOW_IMAGE]: Schemas.Map({
    src: Schemas.String,
    align: Schemas.EnumNumber(AlignMode, AlignMode.TAM_MIDDLE_CENTER),
    height: Schemas.Float,
    width: Schemas.Float,
    hideAfterSeconds: Schemas.Optional(Schemas.Float),
    text: Schemas.Optional(Schemas.String),
    fontSize: Schemas.Optional(Schemas.Float),
  }),
  [ActionType.HIDE_IMAGE]: Schemas.Map({
    imageEntity: Schemas.Optional(Schemas.Int),
  }),
  [ActionType.DAMAGE]: Schemas.Map({
    radius: Schemas.Float,
    layer: Schemas.Optional(Schemas.EnumString(ProximityLayer, ProximityLayer.ALL)),
    hits: Schemas.Optional(Schemas.Int),
  }),
  [ActionType.MOVE_PLAYER_HERE]: Schemas.Map({}),
  [ActionType.PLAYER_FACE_ITEM]: Schemas.Map({}),
  [ActionType.PLACE_ON_PLAYER]: Schemas.Map({}),
  [ActionType.ROTATE_AS_PLAYER]: Schemas.Map({}),
  [ActionType.PLACE_ON_CAMERA]: Schemas.Map({}),
  [ActionType.ROTATE_AS_CAMERA]: Schemas.Map({}),
  [ActionType.SET_POSITION]: Schemas.Map({
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    relative: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.SET_ROTATION]: Schemas.Map({
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    relative: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.SET_SCALE]: Schemas.Map({
    x: Schemas.Float,
    y: Schemas.Float,
    z: Schemas.Float,
    relative: Schemas.Optional(Schemas.Boolean),
  }),
  [ActionType.FOLLOW_PLAYER]: Schemas.Map({
    speed: Schemas.Float,
    x: Schemas.Boolean,
    y: Schemas.Boolean,
    z: Schemas.Boolean,
    minDistance: Schemas.Float,
  }),
  [ActionType.STOP_FOLLOWING_PLAYER]: Schemas.Map({}),
  [ActionType.RANDOM]: Schemas.Map({
    actions: Schemas.Array(Schemas.String),
  }),
  [ActionType.BATCH]: Schemas.Map({
    actions: Schemas.Array(Schemas.String),
  }),
  [ActionType.HEAL_PLAYER]: Schemas.Map({
    multiplier: Schemas.Int,
  }),
  [ActionType.CLAIM_AIRDROP]: Schemas.Map({}),
  [ActionType.LIGHTS_ON]: Schemas.Map({}),
  [ActionType.LIGHTS_OFF]: Schemas.Map({}),
  [ActionType.LIGHTS_MODIFY]: Schemas.Map({
    active: Schemas.Optional(Schemas.Boolean),
    color: Schemas.Optional(Schemas.Color3),
    intensity: Schemas.Optional(Schemas.Float),
  }),
  [ActionType.CHANGE_CAMERA]: Schemas.Map({
    /** If undefined or 0, treated as NONE */
    virtualCameraEntity: Schemas.Optional(Schemas.Entity),
  }),
  [ActionType.CHANGE_TEXT]: Schemas.Map({
    text: Schemas.String,
    fontSize: Schemas.Optional(Schemas.Float),
    color: Schemas.Optional(Schemas.Color4),
  }),
  [ActionType.STOP_TWEEN]: Schemas.Map({}),
  [ActionType.SLIDE_TEXTURE]: Schemas.Map({
    direction: Schemas.Map({ x: Schemas.Float, y: Schemas.Float }),
    speed: Schemas.Float,
    movementType: Schemas.Optional(
      Schemas.EnumNumber(TextureMovementType, TextureMovementType.TMT_OFFSET),
    ),
    duration: Schemas.Optional(Schemas.Float),
  }),
  [ActionType.FREEZE_PLAYER]: Schemas.Map({}),
  [ActionType.UNFREEZE_PLAYER]: Schemas.Map({}),
};

export type ActionPayload<T extends ActionType = any> = T extends keyof typeof ActionSchemas
  ? (typeof ActionSchemas)[T] extends ISchema
    ? ReturnType<(typeof ActionSchemas)[T]['deserialize']>
    : Record<string, never>
  : Record<string, never>;

export function getComponent<T>(componentName: string, engine: IEngine) {
  try {
    return engine.getComponent(componentName) as LastWriteWinElementSetComponentDefinition<T>;
  } catch (error) {
    console.error(`Error using getComponent with componentName="${componentName}"`);
    throw error;
  }
}

export function getComponents(engine: IEngine) {
  return {
    Actions: getComponent<Actions>(ComponentName.ACTIONS, engine),
    States: getComponent<States>(ComponentName.STATES, engine),
    Counter: getComponent<Counter>(ComponentName.COUNTER, engine),
    Triggers: getComponent<Triggers>(ComponentName.TRIGGERS, engine),
    CounterBar: getComponent<CounterBar>(ComponentName.COUNTER_BAR, engine),
    AdminTools: getComponent<AdminTools>(ComponentName.ADMIN_TOOLS, engine),
    VideoScreen: getComponent<VideoScreen>(ComponentName.VIDEO_SCREEN, engine),
    Rewards: getComponent<Rewards>(ComponentName.REWARDS, engine),
    TextAnnouncements: getComponent<TextAnnouncements>(ComponentName.TEXT_ANNOUNCEMENTS, engine),
    VideoControlState: getComponent<VideoControlState>(ComponentName.VIDEO_CONTROL_STATE, engine),
    Script: getComponent<Script>(ComponentName.SCRIPT, engine),
  };
}

export function createComponents(engine: IEngine) {
  const ActionTypes = engine.defineComponent(ComponentName.ACTION_TYPES, {
    value: Schemas.Array(
      Schemas.Map({
        type: Schemas.String,
        jsonSchema: Schemas.String,
      }),
    ),
  });

  const Actions = engine.defineComponent(ComponentName.ACTIONS, {
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
  });

  const Counter = engine.defineComponent(ComponentName.COUNTER, {
    id: Schemas.Number,
    value: Schemas.Int,
  });

  const Triggers = engine.defineComponent(ComponentName.TRIGGERS, {
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
  });

  const States = engine.defineComponent(ComponentName.STATES, {
    id: Schemas.Number,
    value: Schemas.Array(Schemas.String),
    defaultValue: Schemas.Optional(Schemas.String),
    currentValue: Schemas.Optional(Schemas.String),
    previousValue: Schemas.Optional(Schemas.String),
  });

  const CounterBar = engine.defineComponent(ComponentName.COUNTER_BAR, {
    primaryColor: Schemas.Optional(Schemas.String),
    secondaryColor: Schemas.Optional(Schemas.String),
    maxValue: Schemas.Optional(Schemas.Float),
  });

  const VideoScreen = engine.defineComponent(ComponentName.VIDEO_SCREEN, {
    thumbnail: Schemas.String,
    defaultMediaSource: Schemas.EnumNumber<MediaSource>(MediaSource, MediaSource.VideoURL),
    defaultURL: Schemas.String,
  });

  const AdminTools = engine.defineComponent(ComponentName.ADMIN_TOOLS, {
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
  });

  const Rewards = engine.defineComponent(ComponentName.REWARDS, {
    campaignId: Schemas.String,
    dispenserKey: Schemas.String,
    testMode: Schemas.Boolean,
  });

  const TextAnnouncements = engine.defineComponent(ComponentName.TEXT_ANNOUNCEMENTS, {
    text: Schemas.String,
    author: Schemas.Optional(Schemas.String),
    id: Schemas.String,
  });

  const VideoControlState = engine.defineComponent(ComponentName.VIDEO_CONTROL_STATE, {
    endsAt: Schemas.Optional(Schemas.Int64),
    /** @deprecated streamKey is deprecated and will be removed in a future version */
    streamKey: Schemas.Optional(Schemas.String),
  });

  const Script = engine.defineComponent(ComponentName.SCRIPT, {
    value: Schemas.Array(
      Schemas.Map({
        path: Schemas.String,
        priority: Schemas.Number,
        layout: Schemas.Optional(Schemas.String),
      }),
    ),
  });

  return {
    ActionTypes,
    Actions,
    Counter,
    Triggers,
    States,
    CounterBar,
    AdminTools,
    Rewards,
    TextAnnouncements,
    VideoControlState,
    VideoScreen,
    Script,
  };
}

export type EngineComponents = {
  Animator: AnimatorComponentDefinitionExtended;
  Transform: TransformComponentExtended;
  AudioSource: AudioSourceComponentDefinitionExtended;
  AvatarAttach: LastWriteWinElementSetComponentDefinition<PBAvatarAttach>;
  VisibilityComponent: LastWriteWinElementSetComponentDefinition<PBVisibilityComponent>;
  GltfContainer: LastWriteWinElementSetComponentDefinition<PBGltfContainer>;
  Material: MaterialComponentDefinitionExtended;
  MeshRenderer: MeshRendererComponentDefinitionExtended;
  VideoPlayer: LastWriteWinElementSetComponentDefinition<PBVideoPlayer>;
  LightSource: LastWriteWinElementSetComponentDefinition<PBLightSource>;
  VirtualCamera: LastWriteWinElementSetComponentDefinition<PBVirtualCamera>;
  MainCamera: LastWriteWinElementSetComponentDefinition<PBMainCamera>;
  TextShape: LastWriteWinElementSetComponentDefinition<PBTextShape>;
  UiTransform: LastWriteWinElementSetComponentDefinition<PBUiTransform>;
  UiText: LastWriteWinElementSetComponentDefinition<PBUiText>;
  UiBackground: LastWriteWinElementSetComponentDefinition<PBUiBackground>;
  UiInput: LastWriteWinElementSetComponentDefinition<PBUiInput>;
  UiInputResult: LastWriteWinElementSetComponentDefinition<PBUiInputResult>;
  UiCanvasInformation: LastWriteWinElementSetComponentDefinition<PBUiCanvasInformation>;
  Billboard: LastWriteWinElementSetComponentDefinition<PBBillboard>;
  Name: LastWriteWinElementSetComponentDefinition<NameType>;
  Tween: LastWriteWinElementSetComponentDefinition<PBTween>;
  TweenSequence: LastWriteWinElementSetComponentDefinition<PBTweenSequence>;
  PointerEvents: LastWriteWinElementSetComponentDefinition<PBPointerEvents>;
  NetworkEntity: typeof NetworkEntity;
  SyncComponents: typeof SyncComponents;
  InputModifier: InputModifierComponentDefinitionExtended;
};

export function initComponents(engine: IEngine) {
  // Add actions from this package
  const actionTypes = Object.values(ActionType);
  for (const type of actionTypes) {
    const actionType = type as ActionType;
    addActionType(engine, actionType, ActionSchemas[actionType]);
  }

  // Add counter to root entity
  const Counter = engine.getComponent(
    ComponentName.COUNTER,
  ) as LastWriteWinElementSetComponentDefinition<Counter>;
  const counter = Counter.getOrCreateMutable(engine.RootEntity);
  counter.value = counter.value || 0;

  const { VideoPlayer, Material } = getExplorerComponents(engine);
  initVideoPlayerComponents(engine, { VideoPlayer, Material });
}

function getVideoTexture({ material }: PBMaterial): VideoTexture | undefined {
  if (material?.$case === 'unlit' && material.unlit.texture?.tex?.$case === 'videoTexture') {
    return material.unlit.texture.tex.videoTexture;
  }

  return undefined;
}

export function initVideoPlayerComponentMaterial(
  entity: Entity,
  { Material }: Pick<EngineComponents, 'Material'>,
  material?: PBMaterial | null,
) {
  if (!material || !material.material || material.material.$case !== 'unlit') {
    return null;
  }

  Material.setBasicMaterial(entity, {
    ...material.material.unlit,
    texture: Material.Texture.Video({
      videoPlayerEntity: entity,
    }),
  });
}

function initVideoPlayerComponents(
  engine: IEngine,
  components: Pick<EngineComponents, 'Material' | 'VideoPlayer'>,
) {
  function replaceVideoTexture() {
    const { Material, VideoPlayer } = components;
    engine.removeSystem(replaceVideoTexture);
    for (const [entity, material] of engine.getEntitiesWith(Material, VideoPlayer)) {
      const videoTexture = getVideoTexture(material);
      if (videoTexture?.videoPlayerEntity === engine.RootEntity) {
        initVideoPlayerComponentMaterial(entity, components, material);
      }
    }
  }
  engine.addSystem(replaceVideoTexture);
}

export function getConditionTypesByComponentName(componentName: ComponentName) {
  switch (componentName) {
    case ComponentName.STATES: {
      return [
        TriggerConditionType.WHEN_STATE_IS,
        TriggerConditionType.WHEN_STATE_IS_NOT,
        TriggerConditionType.WHEN_PREVIOUS_STATE_IS,
        TriggerConditionType.WHEN_PREVIOUS_STATE_IS_NOT,
      ];
    }
    case ComponentName.COUNTER: {
      return [
        TriggerConditionType.WHEN_COUNTER_EQUALS,
        TriggerConditionType.WHEN_COUNTER_IS_GREATER_THAN,
        TriggerConditionType.WHEN_COUNTER_IS_LESS_THAN,
      ];
    }
    case ComponentName.ACTIONS: {
      return [
        TriggerConditionType.WHEN_DISTANCE_TO_PLAYER_LESS_THAN,
        TriggerConditionType.WHEN_DISTANCE_TO_PLAYER_GREATER_THAN,
      ];
    }
    default: {
      return [];
    }
  }
}

export type Components = ReturnType<typeof createComponents>;

export type ActionTypesComponent = Components['ActionTypes'];
export type ActionTypes = ReturnType<ActionTypesComponent['schema']['deserialize']>;

export type ActionsComponent = Components['Actions'];
export type Actions = ReturnType<ActionsComponent['schema']['deserialize']>;
export type Action = Actions['value'][0];

export type CounterComponent = Components['Counter'];
export type Counter = ReturnType<CounterComponent['schema']['deserialize']>;

export type CounterBarComponent = Components['CounterBar'];
export type CounterBar = ReturnType<CounterBarComponent['schema']['deserialize']>;

export type TriggersComponent = Components['Triggers'];
export type Triggers = ReturnType<TriggersComponent['schema']['deserialize']>;
export type Trigger = Triggers['value'][0];
export type TriggerAction = Trigger['actions'][0];
export type TriggerCondition = Exclude<Trigger['conditions'], undefined>[0];

export type StatesComponent = Components['States'];
export type States = ReturnType<StatesComponent['schema']['deserialize']>;

export type AdminToolsComponent = Components['AdminTools'];
export type AdminTools = ReturnType<AdminToolsComponent['schema']['deserialize']>;

export type VideoScreenComponent = Components['VideoScreen'];
export type VideoScreen = ReturnType<VideoScreenComponent['schema']['deserialize']>;

export type RewardsComponent = Components['Rewards'];
export type Rewards = ReturnType<RewardsComponent['schema']['deserialize']>;

export type TextAnnouncementsComponent = Components['TextAnnouncements'];
export type TextAnnouncements = ReturnType<TextAnnouncementsComponent['schema']['deserialize']>;

export type VideoControlStateComponent = Components['VideoControlState'];
export type VideoControlState = ReturnType<VideoControlStateComponent['schema']['deserialize']>;

export type ScriptComponent = Components['Script'];
export type Script = ReturnType<ScriptComponent['schema']['deserialize']>;
