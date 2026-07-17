import { engine, Transform, MeshRenderer, Material, GltfContainer } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Vector3, Quaternion, Color3, Color4 } from '@dcl/sdk/math';
import type { SpawnArea } from '@dcl/inspector-bevy-protocol';

import { getSceneOffset } from './gizmo';

/**
 * Draw the scene's spawn points/areas in the editor (#1374), matching the Babylon
 * editor: an avatar-placeholder GLB marker at each spawn point, plus a flat
 * translucent area plane when the point defines a range (an area, not a point).
 * The inspector sends the full set (`set-spawn-areas`) whenever the scene's
 * spawnPoints metadata changes; positions are scene-local (+ sceneOffset →
 * engine-world). Multiple spawn points → multiple markers.
 *
 * Rendered on the MAIN camera layer (not the gizmo overlay) so the markers sit in
 * the world like scene geometry. Non-interactive (no collider): they're a
 * visualization; the spawn move gizmo is the drag affordance.
 */

// The avatar-placeholder GLB, bundled in the agent scene's content (assets/), the
// same model the Babylon editor uses for spawn points.
const AVATAR_GLB = 'assets/spawn_point_avatar.glb';
// Area plane hover just above ground to avoid z-fighting.
const AREA_Y = 0.02;
const DEFAULT_COLOR = Color3.create(0.3, 1, 0.4);
const AREA_COLOR = Color3.create(0.3, 0.7, 1);
// A flat plane is authored in the XY plane; rotate -90° about X to lay it flat.
const FLAT = Quaternion.fromEulerDegrees(90, 0, 0);

interface SpawnVisual {
  avatar: Entity;
  area: Entity | null;
}

let visuals: SpawnVisual[] = [];

function clear(): void {
  for (const v of visuals) {
    engine.removeEntity(v.avatar);
    if (v.area !== null) engine.removeEntity(v.area);
  }
  visuals = [];
}

/** Replace the drawn spawn visuals with `areas` (empty clears them). */
export function setSpawnAreas(areas: SpawnArea[]): void {
  clear();
  const offset = getSceneOffset();
  for (const area of areas) {
    const worldCenter = Vector3.add(
      Vector3.create(area.center.x, area.center.y, area.center.z),
      offset,
    );

    // Avatar GLB marker at the spawn position.
    const avatar = engine.addEntity();
    Transform.create(avatar, { position: worldCenter });
    GltfContainer.create(avatar, { src: AVATAR_GLB });

    // Flat translucent area plane only when the point defines a range.
    let areaEntity: Entity | null = null;
    const width = area.halfExtents.x * 2;
    const depth = area.halfExtents.z * 2;
    if (width > 0 || depth > 0) {
      areaEntity = engine.addEntity();
      Transform.create(areaEntity, {
        position: Vector3.create(worldCenter.x, worldCenter.y + AREA_Y, worldCenter.z),
        rotation: FLAT,
        scale: Vector3.create(Math.max(width, 0.01), Math.max(depth, 0.01), 1),
      });
      MeshRenderer.setPlane(areaEntity);
      const c = area.isDefault ? DEFAULT_COLOR : AREA_COLOR;
      Material.setPbrMaterial(areaEntity, {
        albedoColor: Color4.create(c.r, c.g, c.b, area.isDefault ? 0.35 : 0.25),
        emissiveColor: c,
        emissiveIntensity: 0.3,
      });
    }

    visuals.push({ avatar, area: areaEntity });
  }
}
