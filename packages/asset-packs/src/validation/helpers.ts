import type { AssetComposite } from '../types';

// SDK defaults for GltfContainer collision masks (from @dcl/ecs)
const CL_POINTER = 1;
const CL_PHYSICS = 2;
const GLTF_DEFAULT_VISIBLE_MASK = 0; // CL_NONE
const GLTF_DEFAULT_INVISIBLE_MASK = CL_PHYSICS;

type Component = AssetComposite['components'][number];

export function getComponent(components: Component[], name: string): Component | undefined {
  return components.find(c => c.name === name);
}

export function hasComponent(components: Component[], name: string): boolean {
  return components.some(c => c.name === name);
}

export function getComponentData(components: Component[], name: string): any | undefined {
  return getComponent(components, name)?.data?.['0']?.json;
}

/**
 * Check if entity has a collider with the given mask.
 * GltfContainer is considered a valid pointer collider because GLTF models
 * can have internal collider meshes (*_collider) that the SDK uses for raycasting.
 */
export function hasPointerCollider(components: Component[]): boolean {
  const meshCollider = getComponentData(components, 'core::MeshCollider');
  if (meshCollider && (meshCollider.collisionMask & CL_POINTER) !== 0) return true;

  // GltfContainer models support pointer raycasting via their visible meshes
  // and internal *_collider meshes, even without explicit collision masks
  if (hasComponent(components, 'core::GltfContainer')) return true;

  return false;
}

/**
 * Check if entity has any explicit collision mask > 0 set.
 * Uses SDK defaults when values are not specified in the composite.
 */
export function hasAnyCollisionMask(components: Component[]): boolean {
  const meshCollider = getComponentData(components, 'core::MeshCollider');
  if (meshCollider && meshCollider.collisionMask > 0) return true;

  const gltf = getComponentData(components, 'core::GltfContainer');
  if (gltf) {
    const visibleMask = gltf.visibleMeshesCollisionMask ?? GLTF_DEFAULT_VISIBLE_MASK;
    const invisibleMask = gltf.invisibleMeshesCollisionMask ?? GLTF_DEFAULT_INVISIBLE_MASK;
    if (visibleMask > 0 || invisibleMask > 0) return true;
  }

  return false;
}

/**
 * Check if an action type creates a component dynamically at runtime.
 * These components won't exist in the composite but are created by action handlers.
 */
const RUNTIME_CREATED_COMPONENTS: Record<string, string[]> = {
  play_animation: ['core::Animator'],
  stop_animation: ['core::Animator'],
  play_sound: ['core::AudioSource'],
  stop_sound: ['core::AudioSource'],
  set_visibility: ['core::VisibilityComponent'],
  play_video_stream: ['core::VideoPlayer'],
  play_audio_stream: ['core::AudioStream'],
  attach_to_player: ['core::AvatarAttach'],
};

// Trigger types that create PointerEvents at runtime
const TRIGGER_CREATED_COMPONENTS: Record<string, string[]> = {
  on_click: ['core::PointerEvents'],
  on_input_action: ['core::PointerEvents'],
};

/**
 * Get all components that will be created dynamically at runtime by the item's actions.
 */
export function getRuntimeCreatedComponents(components: Component[]): Set<string> {
  const result = new Set<string>();
  const actions = getComponentData(components, 'asset-packs::Actions');
  if (!actions?.value) return result;

  for (const action of actions.value) {
    const created = RUNTIME_CREATED_COMPONENTS[action.type];
    if (created) {
      for (const name of created) result.add(name);
    }
  }

  // Also check triggers for components created by the trigger system
  const triggers = getComponentData(components, 'asset-packs::Triggers');
  if (triggers?.value) {
    for (const trigger of triggers.value) {
      const created = TRIGGER_CREATED_COMPONENTS[trigger.type];
      if (created) {
        for (const name of created) result.add(name);
      }
    }
  }

  return result;
}
