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
import { Coords, SceneAgeRating, SceneCategory } from './SceneMetadata';
import type { ConfigComponentType } from './Config';
import type { InspectorUIStateType } from './InspectorUIState';
import { EditorComponentNames as BaseEditorComponentNames } from './types';
import { defineAllComponents as defineAllInspectorComponents } from './versioning/registry';

export { SceneAgeRating, SceneCategory };
export { CoreComponents, AllComponentsType } from './types';

// Override the Scene property with the dynamic value
export const EditorComponentNames = {
  ...BaseEditorComponentNames,
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
  // Define all versioned inspector components from registry
  const inspectorComponents = defineAllInspectorComponents(engine);

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

  return {
    Selection: inspectorComponents['inspector::Selection'],
    Scene: inspectorComponents['inspector::SceneMetadata'],
    Nodes: inspectorComponents['inspector::Nodes'],
    TransformConfig: inspectorComponents['inspector::TransformConfig'],
    Hide: inspectorComponents['inspector::Hide'],
    Lock: inspectorComponents['inspector::Lock'],
    Config: inspectorComponents['inspector::Config'],
    InspectorUIState: inspectorComponents['inspector::UIState'],
    Ground: inspectorComponents['inspector::Ground'],
    Tile: inspectorComponents['inspector::Tile'],
    CustomAsset: inspectorComponents['inspector::CustomAsset'],
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
