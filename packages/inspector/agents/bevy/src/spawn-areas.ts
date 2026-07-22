import {
  engine,
  Transform,
  MeshRenderer,
  MeshCollider,
  ColliderLayer,
  Material,
  GltfContainer,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Vector3, Quaternion, Color3, Color4 } from '@dcl/sdk/math';
import type { SpawnArea } from '@dcl/inspector-bevy-protocol';

import { getSceneOffset } from './gizmo';
import { registerSpawnMarker, clearSpawnMarkers } from './spawn-markers';

/**
 * Draw the scene's spawn points/areas in the editor (#1374), matching the Babylon
 * editor: an avatar-placeholder GLB marker at each spawn point, plus a flat
 * translucent area plane when the point defines a range (an area, not a point).
 * The inspector sends the full set (`set-spawn-areas`) whenever the scene's
 * spawnPoints metadata changes; positions are scene-local (+ sceneOffset →
 * engine-world). Multiple spawn points → multiple markers.
 *
 * Rendered on the MAIN camera layer (not the gizmo overlay) so the markers sit in
 * the world like scene geometry. The avatar + camera-target markers carry pointer
 * colliders and are registered in spawn-markers so a viewport click selects the
 * spawn point / target (#2); the area plane stays non-interactive.
 */

// The avatar-placeholder GLB, bundled in the agent scene's content (assets/), the
// same model the Babylon editor uses for spawn points.
const AVATAR_GLB = 'assets/spawn_point_avatar.glb';
// Area plane hover just above ground to avoid z-fighting.
const AREA_Y = 0.02;
const DEFAULT_COLOR = Color3.create(0.3, 1, 0.4);
const AREA_COLOR = Color3.create(0.3, 0.7, 1);
// The camera-target marker: a small cube (matching Babylon's createCameraTargetCube).
const CAMERA_TARGET_COLOR = Color3.create(1, 0.75, 0.2);
const CAMERA_TARGET_SIZE = 0.4;
// The avatar's clickable hitbox extent (a humanoid ~1.8m tall, ~0.8m wide).
const AVATAR_HITBOX_W = 0.8;
const AVATAR_HITBOX_H = 1.9;
// A flat plane is authored in the XY plane; rotate -90° about X to lay it flat.
const FLAT = Quaternion.fromEulerDegrees(90, 0, 0);

interface SpawnVisual {
  avatar: Entity;
  hitbox: Entity;
  area: Entity | null;
  cameraTarget: Entity | null;
}

let visuals: SpawnVisual[] = [];

function clear(): void {
  for (const v of visuals) {
    engine.removeEntity(v.hitbox);
    engine.removeEntity(v.avatar);
    if (v.area !== null) engine.removeEntity(v.area);
    if (v.cameraTarget !== null) engine.removeEntity(v.cameraTarget);
  }
  visuals = [];
  clearSpawnMarkers();
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

    // Avatar GLB marker at the spawn position, rotated on Y to face the camera
    // target (#4, matching Babylon's rotateAvatarToFaceTarget).
    const avatar = engine.addEntity();
    Transform.create(avatar, {
      position: worldCenter,
      rotation: Quaternion.fromEulerDegrees(0, ((area.facingY ?? 0) * 180) / Math.PI, 0),
    });
    GltfContainer.create(avatar, { src: AVATAR_GLB });
    // Pointer collider so clicking the avatar selects the spawn point (#2). A bare
    // MeshCollider.setBox is only a ~1m³ cube at the origin, so clicking the head/
    // feet missed. Use a CHILD box scaled to the avatar's full extent (~0.8m wide,
    // ~1.9m tall, centred at ~0.95m up) so the whole model is clickable. The child's
    // entity id is what the raycast returns, so register THAT id.
    const hitbox = engine.addEntity();
    Transform.create(hitbox, {
      position: Vector3.create(0, AVATAR_HITBOX_H / 2, 0),
      scale: Vector3.create(AVATAR_HITBOX_W, AVATAR_HITBOX_H, AVATAR_HITBOX_W),
      parent: avatar,
    });
    MeshCollider.setBox(hitbox, ColliderLayer.CL_POINTER);
    registerSpawnMarker(hitbox as number, { index: area.index, target: 'position' });

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

    // Camera-target marker (#3): a small cube at the target position, nested under
    // the spawn in the tree. Only when the spawn defines a camera target.
    let cameraTargetEntity: Entity | null = null;
    if (area.cameraTarget) {
      cameraTargetEntity = engine.addEntity();
      Transform.create(cameraTargetEntity, {
        position: Vector3.add(
          Vector3.create(area.cameraTarget.x, area.cameraTarget.y, area.cameraTarget.z),
          offset,
        ),
        scale: Vector3.create(CAMERA_TARGET_SIZE, CAMERA_TARGET_SIZE, CAMERA_TARGET_SIZE),
      });
      MeshRenderer.setBox(cameraTargetEntity);
      MeshCollider.setBox(cameraTargetEntity, ColliderLayer.CL_POINTER);
      registerSpawnMarker(cameraTargetEntity as number, {
        index: area.index,
        target: 'cameraTarget',
      });
      Material.setPbrMaterial(cameraTargetEntity, {
        albedoColor: Color4.create(
          CAMERA_TARGET_COLOR.r,
          CAMERA_TARGET_COLOR.g,
          CAMERA_TARGET_COLOR.b,
          0.9,
        ),
        emissiveColor: CAMERA_TARGET_COLOR,
        emissiveIntensity: 0.5,
      });
    }

    visuals.push({ avatar, hitbox, area: areaEntity, cameraTarget: cameraTargetEntity });
  }
}
