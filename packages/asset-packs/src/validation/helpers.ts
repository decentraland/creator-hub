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
