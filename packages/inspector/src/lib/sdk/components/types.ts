import { ComponentName } from '@dcl/asset-packs';
import { getLatestSceneComponentVersion } from './SceneMetadata';
import { BaseComponentNames, getLatestVersionName } from './versioning/constants';

export enum CoreComponents {
  ANIMATOR = 'core::Animator',
  AUDIO_SOURCE = 'core::AudioSource',
  AUDIO_STREAM = 'core::AudioStream',
  AVATAR_ATTACH = 'core::AvatarAttach',
  BILLBOARD = 'core::Billboard',
  GLTF_CONTAINER = 'core::GltfContainer',
  NETWORK_ENTITY = 'core-schema::Network-Entity',
  MATERIAL = 'core::Material',
  MESH_COLLIDER = 'core::MeshCollider',
  MESH_RENDERER = 'core::MeshRenderer',
  NFT_SHAPE = 'core::NftShape',
  POINTER_EVENTS = 'core::PointerEvents',
  SYNC_COMPONENTS = 'core-schema::Sync-Components',
  TEXT_SHAPE = 'core::TextShape',
  TRANSFORM = 'core::Transform',
  TWEEN = 'core::Tween',
  TWEEN_SEQUENCE = 'core::TweenSequence',
  VIDEO_PLAYER = 'core::VideoPlayer',
  VISIBILITY_COMPONENT = 'core::VisibilityComponent',
  LIGHT_SOURCE = 'core::LightSource',
  GLTF_NODE_MODIFIERS = 'core::GltfNodeModifiers',
  VIRTUAL_CAMERA = 'core::VirtualCamera',
}

export const EditorComponentNames = {
  Selection: getLatestVersionName(BaseComponentNames.SELECTION),
  Scene: getLatestSceneComponentVersion().key,
  Nodes: getLatestVersionName(BaseComponentNames.NODES),
  ActionTypes: ComponentName.ACTION_TYPES,
  Actions: ComponentName.ACTIONS,
  Counter: ComponentName.COUNTER,
  CounterBar: ComponentName.COUNTER_BAR,
  Triggers: ComponentName.TRIGGERS,
  States: ComponentName.STATES,
  TransformConfig: getLatestVersionName(BaseComponentNames.TRANSFORM_CONFIG),
  Hide: getLatestVersionName(BaseComponentNames.HIDE),
  Lock: getLatestVersionName(BaseComponentNames.LOCK),
  Config: getLatestVersionName(BaseComponentNames.CONFIG),
  Ground: getLatestVersionName(BaseComponentNames.GROUND),
  Tile: getLatestVersionName(BaseComponentNames.TILE),
  CustomAsset: getLatestVersionName(BaseComponentNames.CUSTOM_ASSET),
  AdminTools: ComponentName.ADMIN_TOOLS,
  Rewards: ComponentName.REWARDS,
  VideoScreen: ComponentName.VIDEO_SCREEN,
  InspectorUIState: getLatestVersionName(BaseComponentNames.INSPECTOR_UI_STATE),
  Script: ComponentName.SCRIPT,
} as const;

export type AllComponentsType =
  | CoreComponents
  | (typeof EditorComponentNames)[keyof typeof EditorComponentNames];

export const AllComponents = {
  ...CoreComponents,
  ...EditorComponentNames,
};
