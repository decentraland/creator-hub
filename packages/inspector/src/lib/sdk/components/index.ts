import type {
  ComponentDefinition,
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
} from '@dcl/ecs';
import { Schemas } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import type {
  States,
  ActionTypes,
  Actions,
  Triggers,
  Counter,
  CounterBar,
  AdminTools,
  Rewards,
  VideoScreen,
  Script,
} from '@dcl/asset-packs';
import { createComponents as createAssetPacksComponents } from '@dcl/asset-packs';
import type { Layout } from '../../utils/layout';
import type { TransitionMode } from './SceneMetadata';
import {
  Coords,
  defineSceneComponents,
  getLatestSceneComponentVersion,
  SceneAgeRating,
  SceneCategory,
} from './SceneMetadata';
import {
  defineAllVersionedComponents,
  BaseComponentNames,
  type InspectorVersionedComponents,
} from './versioning/constants';
import { EditorComponentNames as BaseEditorComponentNames } from './types';

export { SceneAgeRating, SceneCategory };
export { CoreComponents, AllComponentsType } from './types';

// Override the Scene property with the dynamic value
export const EditorComponentNames = {
  ...BaseEditorComponentNames,
  Scene: getLatestSceneComponentVersion().key,
} as const;

export type Component<T = unknown> = ComponentDefinition<T>;
export type Node = { entity: Entity; open?: boolean; children: Entity[] };

export type SceneSpawnPointCoord =
  | { $case: 'single'; value: number }
  | { $case: 'range'; value: number[] };

export type SceneSpawnPoint = {
  name: string;
  default?: boolean;
  position: {
    x: SceneSpawnPointCoord;
    y: SceneSpawnPointCoord;
    z: SceneSpawnPointCoord;
  };
  cameraTarget?: {
    x: number;
    y: number;
    z: number;
  };
};

export type SceneComponent = {
  creator?: string;
  name?: string;
  description?: string;
  skyboxConfig?: {
    fixedTime?: number;
    transitionMode?: TransitionMode;
  };
  thumbnail?: string;
  ageRating?: SceneAgeRating;
  main?: string;
  categories?: SceneCategory[];
  author?: string;
  email?: string;
  tags?: string[];
  layout: Layout;
  silenceVoiceChat?: boolean;
  disablePortableExperiences?: boolean;
  spawnPoints?: SceneSpawnPoint[];
};

/**
 * Utility type to extract the value type from a component definition
 */
type ComponentValue<T> = T extends LastWriteWinElementSetComponentDefinition<infer V> ? V : never;

/**
 * Value types for all editor components.
 * Inspector versioned components automatically use the latest version type from their definitions.
 */
export type EditorComponentsTypes = {
  Selection: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.SELECTION]>;
  Nodes: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.NODES]>;
  TransformConfig: ComponentValue<
    InspectorVersionedComponents[typeof BaseComponentNames.TRANSFORM_CONFIG]
  >;
  Hide: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.HIDE]>;
  Lock: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.LOCK]>;
  Ground: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.GROUND]>;
  Tile: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.TILE]>;
  CustomAsset: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.CUSTOM_ASSET]>;
  Config: ComponentValue<InspectorVersionedComponents[typeof BaseComponentNames.CONFIG]>;
  InspectorUIState: ComponentValue<
    InspectorVersionedComponents[typeof BaseComponentNames.INSPECTOR_UI_STATE]
  >;
  // Other components
  Scene: SceneComponent;
  ActionTypes: ActionTypes;
  Actions: Actions;
  Triggers: Triggers;
  States: States;
  Counter: Counter;
  CounterBar: CounterBar;
  AdminTools: AdminTools;
  VideoScreen: VideoScreen;
  Rewards: Rewards;
  Script: Script;
};

export type EditorComponents = {
  Selection: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Selection']>;
  Scene: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;
  Nodes: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Nodes']>;
  TransformConfig: LastWriteWinElementSetComponentDefinition<
    EditorComponentsTypes['TransformConfig']
  >;
  ActionTypes: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['ActionTypes']>;
  Actions: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Actions']>;
  Counter: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Counter']>;
  Triggers: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Triggers']>;
  States: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['States']>;
  Hide: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Hide']>;
  Lock: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Lock']>;
  CounterBar: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['CounterBar']>;
  Config: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Config']>;
  Ground: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Ground']>;
  Tile: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Tile']>;
  CustomAsset: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['CustomAsset']>;
  AdminTools: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['AdminTools']>;
  VideoScreen: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['VideoScreen']>;
  Rewards: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Rewards']>;
  InspectorUIState: LastWriteWinElementSetComponentDefinition<
    EditorComponentsTypes['InspectorUIState']
  >;
  Script: LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Script']>;
};

export type SdkComponents = {
  Animator: ReturnType<typeof components.Animator>;
  AudioSource: ReturnType<typeof components.AudioSource>;
  AudioStream: ReturnType<typeof components.AudioStream>;
  AvatarAttach: ReturnType<typeof components.AvatarAttach>;
  Billboard: ReturnType<typeof components.Billboard>;
  GltfContainer: ReturnType<typeof components.GltfContainer>;
  Material: ReturnType<typeof components.Material>;
  MeshCollider: ReturnType<typeof components.MeshCollider>;
  MeshRenderer: ReturnType<typeof components.MeshRenderer>;
  Name: ReturnType<typeof components.Name>;
  NetworkEntity: ReturnType<typeof components.NetworkEntity>;
  NftShape: ReturnType<typeof components.NftShape>;
  PointerEvents: ReturnType<typeof components.PointerEvents>;
  SyncComponents: ReturnType<typeof components.SyncComponents>;
  TextShape: ReturnType<typeof components.TextShape>;
  Transform: ReturnType<typeof components.Transform>;
  Tween: ReturnType<typeof components.Tween>;
  TweenSequence: ReturnType<typeof components.TweenSequence>;
  VirtualCamera: ReturnType<typeof components.VirtualCamera>;
  VideoPlayer: ReturnType<typeof components.VideoPlayer>;
  VisibilityComponent: ReturnType<typeof components.VisibilityComponent>;
  Tags: ReturnType<typeof components.Tags>;
  LightSource: ReturnType<typeof components.LightSource>;
  GltfNodeModifiers: ReturnType<typeof components.GltfNodeModifiers>;
};

export function createComponents(engine: IEngine): SdkComponents {
  const Animator = components.Animator(engine);
  const AudioSource = components.AudioSource(engine);
  const AudioStream = components.AudioStream(engine);
  const AvatarAttach = components.AvatarAttach(engine);
  const Billboard = components.Billboard(engine);
  const GltfContainer = components.GltfContainer(engine);
  const Material = components.Material(engine);
  const MeshCollider = components.MeshCollider(engine);
  const MeshRenderer = components.MeshRenderer(engine);
  const Name = components.Name(engine);
  const NetworkEntity = components.NetworkEntity(engine);
  const NftShape = components.NftShape(engine);
  const PointerEvents = components.PointerEvents(engine);
  const SyncComponents = components.SyncComponents(engine);
  const TextShape = components.TextShape(engine);
  const Transform = components.Transform(engine);
  const Tween = components.Tween(engine);
  const TweenSequence = components.TweenSequence(engine);
  const VirtualCamera = components.VirtualCamera(engine);
  const VideoPlayer = components.VideoPlayer(engine);
  const VisibilityComponent = components.VisibilityComponent(engine);
  const Tags = components.Tags(engine);
  const LightSource = components.LightSource(engine);
  const GltfNodeModifiers = components.GltfNodeModifiers(engine);

  return {
    Animator,
    AudioSource,
    AudioStream,
    AvatarAttach,
    Billboard,
    GltfContainer,
    Material,
    MeshCollider,
    MeshRenderer,
    Name,
    NetworkEntity,
    NftShape,
    PointerEvents,
    SyncComponents,
    Tags,
    TextShape,
    Transform,
    Tween,
    TweenSequence,
    VirtualCamera,
    VideoPlayer,
    VisibilityComponent,
    LightSource,
    GltfNodeModifiers,
  };
}

/* istanbul ignore next */
export function createEditorComponents(engine: IEngine): EditorComponents {
  const {
    ActionTypes,
    Actions,
    Counter,
    Triggers,
    States,
    CounterBar,
    AdminTools,
    Rewards,
    VideoScreen,
    Script,
  } = createAssetPacksComponents(engine as any);

  // legacy component
  // we define the schema of the legacy component for retrocompat purposes
  engine.defineComponent('inspector::Scene', {
    layout: Schemas.Map({
      base: Coords,
      parcels: Schemas.Array(Coords),
    }),
  });
  //TODO change how we define Scene components to use the same approach

  const Scene = defineSceneComponents(engine).pop() as ReturnType<typeof defineSceneComponents>[0];

  const versionedComponents = defineAllVersionedComponents(engine);
  const Selection = versionedComponents[BaseComponentNames.SELECTION];
  const Nodes = versionedComponents[BaseComponentNames.NODES];
  const TransformConfig = versionedComponents[BaseComponentNames.TRANSFORM_CONFIG];
  const Hide = versionedComponents[BaseComponentNames.HIDE];
  const Lock = versionedComponents[BaseComponentNames.LOCK];
  const Ground = versionedComponents[BaseComponentNames.GROUND];
  const Tile = versionedComponents[BaseComponentNames.TILE];
  const CustomAsset = versionedComponents[BaseComponentNames.CUSTOM_ASSET];
  const Config = versionedComponents[BaseComponentNames.CONFIG];
  const InspectorUIState = versionedComponents[BaseComponentNames.INSPECTOR_UI_STATE];

  return {
    Selection,
    Scene,
    Nodes,
    TransformConfig,
    Hide,
    Lock,
    Config,
    InspectorUIState,
    ActionTypes: ActionTypes as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['ActionTypes']
    >,
    Actions: Actions as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Actions']
    >,
    Counter: Counter as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Counter']
    >,
    Triggers: Triggers as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Triggers']
    >,
    States: States as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['States']
    >,
    CounterBar: CounterBar as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['CounterBar']
    >,
    Ground: Ground as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Ground']
    >,
    Tile: Tile as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Tile']
    >,
    CustomAsset: CustomAsset as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['CustomAsset']
    >,
    AdminTools: AdminTools as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['AdminTools']
    >,
    VideoScreen: VideoScreen as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['VideoScreen']
    >,
    Rewards: Rewards as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Rewards']
    >,
    Script: Script as unknown as LastWriteWinElementSetComponentDefinition<
      EditorComponentsTypes['Script']
    >,
  };
}
