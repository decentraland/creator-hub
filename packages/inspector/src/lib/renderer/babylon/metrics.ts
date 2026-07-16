import type { Material, Scene } from '@babylonjs/core';
import { MultiMaterial, Texture } from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';

import type { SceneContext } from '../../babylon/decentraland/SceneContext';
import { getLayoutManager } from '../../babylon/decentraland/layout-manager';
import { GROUND_MESH_PREFIX } from '../../utils/scene';

/**
 * Babylon-specific scene introspection backing {@link RendererMetrics}.
 *
 * The ignore-lists and texture-walking below reference Babylon-internal object
 * names (default materials, GLTFLoader internals, effect-layer RTTs) and editor
 * visual meshes. This is exactly the kind of renderer-private knowledge that
 * belongs behind the boundary — another renderer would compute its metrics
 * against its own internals. It was lifted verbatim from the Metrics panel so
 * the reported numbers are unchanged.
 */

const IGNORE_MESHES = [
  'BackgroundHelper',
  'BackgroundPlane',
  'BackgroundSkybox',
  // Editor environment meshes from createDefaultEnvironment
  'ground',
  'skybox',
  '__root__',
  // Axis indicator meshes from layout manager
  'axis_x_line',
  'axis_y_line',
  'axis_z_line',
  'z_cone_axis',
];

const IGNORE_MESH_PREFIXES = [
  GROUND_MESH_PREFIX,
  'BoundingMesh',
  'axis_',
  'axisHelper',
  'spawn_point_',
];

const IGNORE_MATERIALS = [
  // Babylon default materials
  'BackgroundSkyboxMaterial',
  'BackgroundPlaneMaterial',
  'colorShader',
  'colorShaderOccQuery',
  'skyBox',
  // Utils Materials
  'entity_outside_layout',
  'entity_outside_layout_multimaterial',
  'layout_grid',
  'grid',
  'base-box',
  'collider-material',
  '__GLTFLoader._default',
];

const IGNORE_TEXTURES = [
  // Babylon default textures
  'https://assets.babylonjs.com/environments/backgroundGround.png',
  'https://assets.babylonjs.com/environments/backgroundSkybox.dds',
  'https://assets.babylonjs.com/environments/environmentSpecular.env',
  'EffectLayerMainRTT',
  'HighlightLayerBlurRTT',
  'data:EnvironmentBRDFTexture0',
  // Utils Textures
  'GlowLayerBlurRTT',
  'GlowLayerBlurRTT2',
];

function collectTexturesFromMaterial(material: Material, textures: Set<string>): void {
  for (const key in material) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (material as any)[key];
    if (value && typeof value === 'object' && 'getInternalTexture' in value) {
      const texture = value;
      if (IGNORE_TEXTURES.includes(texture.name)) continue;

      const isTexture = texture instanceof Texture;
      const url = isTexture ? (texture as Texture).url : texture.name || '';

      if (url && url.startsWith('data:') && url.includes('EnvironmentBRDFTexture')) continue;

      if (url) {
        textures.add(url);
      } else {
        const internalTexture = texture.getInternalTexture();
        if (internalTexture?.uniqueId != null) {
          textures.add(`__uniqueId_${internalTexture.uniqueId}`);
        }
      }
    }
  }
}

function isUserMesh(meshId: string): boolean {
  if (IGNORE_MESHES.includes(meshId)) return false;
  return !IGNORE_MESH_PREFIXES.some(prefix => meshId.startsWith(prefix));
}

export function computeSceneMetrics(scene: Scene): {
  triangles: number;
  bodies: number;
  materials: number;
  textures: number;
} {
  const meshes = scene.meshes.filter(mesh => isUserMesh(mesh.id) && !mesh.metadata?.isPlaceholder);

  let triangles = 0;
  const materials = new Set<string>();
  const textures = new Set<string>();

  for (const mesh of meshes) {
    const indices = mesh.getTotalIndices();
    triangles += indices > 0 ? indices / 3 : Math.floor(mesh.getTotalVertices() / 3);

    const material = mesh.material;
    if (!material) continue;
    const subs = material instanceof MultiMaterial ? material.subMaterials : [material];
    for (const sub of subs) {
      if (!sub || IGNORE_MATERIALS.includes(sub.id)) continue;
      materials.add(sub.id);
      collectTexturesFromMaterial(sub, textures);
    }
  }

  return {
    triangles: Math.floor(triangles),
    bodies: meshes.length,
    materials: materials.size,
    textures: textures.size,
  };
}

export function computeEntitiesOutsideLayout(scene: Scene, context: SceneContext): Entity[] {
  const { isEntityOutsideLayout } = getLayoutManager(scene);
  const outside: Entity[] = [];
  for (const node of context.getAllEntities()) {
    if (node.boundingInfoMesh && isEntityOutsideLayout(node.boundingInfoMesh)) {
      outside.push(node.entityId);
    }
  }
  return outside;
}
