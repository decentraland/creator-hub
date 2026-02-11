import { ComponentName } from '@dcl/asset-packs';
import { getLatestVersionName } from './versioning/registry';

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
  Selection: getLatestVersionName('inspector::Selection'),
  Scene: getLatestVersionName('inspector::SceneMetadata'),
  Nodes: getLatestVersionName('inspector::Nodes'),
  ActionTypes: ComponentName.ACTION_TYPES,
  Actions: ComponentName.ACTIONS,
  Counter: ComponentName.COUNTER,
  CounterBar: ComponentName.COUNTER_BAR,
  Triggers: ComponentName.TRIGGERS,
  States: ComponentName.STATES,
  TransformConfig: getLatestVersionName('inspector::TransformConfig'),
  Hide: getLatestVersionName('inspector::Hide'),
  Lock: getLatestVersionName('inspector::Lock'),
  Config: getLatestVersionName('inspector::Config'),
  Ground: getLatestVersionName('inspector::Ground'),
  Tile: getLatestVersionName('inspector::Tile'),
  CustomAsset: getLatestVersionName('inspector::CustomAsset'),
  AdminTools: ComponentName.ADMIN_TOOLS,
  Rewards: ComponentName.REWARDS,
  VideoScreen: ComponentName.VIDEO_SCREEN,
  InspectorUIState: getLatestVersionName('inspector::UIState'),
  Script: ComponentName.SCRIPT,
} as const;

export type AllComponentsType =
  | CoreComponents
  | (typeof EditorComponentNames)[keyof typeof EditorComponentNames];

export const AllComponents = {
  ...CoreComponents,
  ...EditorComponentNames,
};
