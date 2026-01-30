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
import type { GizmoType } from '../../utils/gizmo';
import type { TransformConfig } from './TransformConfig';
import type { TransitionMode } from './SceneMetadata';
import {
  Coords,
  defineSceneComponents,
  getLatestSceneComponentVersion,
  SceneAgeRating,
  SceneCategory,
} from './SceneMetadata';
import type { ConfigComponentType } from './versioning/definitions/config';
import type { InspectorUIStateType } from './versioning/definitions/inspector-ui-state';
import { defineSelectionComponent } from './versioning/definitions/selection';
import { defineNodesComponent } from './versioning/definitions/nodes';
import { defineTransformConfigComponent } from './versioning/definitions/transform-config';
import { defineHideComponent } from './versioning/definitions/hide';
import { defineLockComponent } from './versioning/definitions/lock';
import { defineGroundComponent } from './versioning/definitions/ground';
import { defineTileComponent } from './versioning/definitions/tile';
import { defineCustomAssetComponent } from './versioning/definitions/custom-asset';
import { defineConfigComponent } from './versioning/definitions/config';
import { defineInspectorUIStateComponent } from './versioning/definitions/inspector-ui-state';
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

// eslint-disable-next-line @typescript-eslint/ban-types
export type GroundComponent = {};
// eslint-disable-next-line @typescript-eslint/ban-types
export type TileComponent = {};

export type CustomAssetComponent = {
  assetId: string;
};

export type EditorComponentsTypes = {
  Selection: { gizmo: GizmoType };
  Scene: SceneComponent;
  Nodes: { value: Node[] };
  TransformConfig: TransformConfig;
  ActionTypes: ActionTypes;
  Actions: Actions;
  Triggers: Triggers;
  States: States;
  Counter: Counter;
  Hide: { value: boolean };
  Lock: { value: boolean };
  CounterBar: CounterBar;
  Config: ConfigComponentType;
  Ground: GroundComponent;
  Tile: TileComponent;
  CustomAsset: CustomAssetComponent;
  AdminTools: AdminTools;
  VideoScreen: VideoScreen;
  Rewards: Rewards;
  InspectorUIState: InspectorUIStateType;
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
  const Nodes = defineNodesComponent(engine);
  const Selection = defineSelectionComponent(engine);
  const TransformConfig = defineTransformConfigComponent(engine);
  const Hide = defineHideComponent(engine);
  const Lock = defineLockComponent(engine);
  const Ground = defineGroundComponent(engine);
  const Tile = defineTileComponent(engine);
  const CustomAsset = defineCustomAssetComponent(engine);
  const Config = defineConfigComponent(engine);
  const InspectorUIState = defineInspectorUIStateComponent(engine);

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
