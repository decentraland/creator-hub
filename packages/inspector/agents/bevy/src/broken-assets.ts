import { engine, Transform, MeshRenderer, Material } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Vector3, Color3, Color4 } from '@dcl/sdk/math';
import type { BrokenAsset } from '@dcl/inspector-bevy-protocol';

import { getSceneOffset } from './gizmo';

/**
 * Draw a placeholder marker for each entity whose GltfContainer asset is
 * missing/invalid (#1465). The engine renders nothing for a broken GLTF, so a
 * deselected broken entity leaves no viewport indication — a builder browsing the
 * scene can't spot it. The inspector detects the broken entities (same "Invalid"
 * signal as the Path field) and sends their world positions here; we render a
 * small emissive-magenta box at each — the universal "missing asset" marker —
 * always visible, independent of selection.
 *
 * Rendered in the agent's own scene with plain SDK components (like the spawn
 * markers), so it sidesteps the inspected scene's content map entirely.
 */

// A distinct "missing asset" magenta — bright + emissive so it reads as a warning,
// not scene geometry.
const MARKER_COLOR = Color3.create(1, 0.15, 0.9);
const MARKER_SIZE = 0.5;

let markers: Entity[] = [];

function clear(): void {
  for (const marker of markers) engine.removeEntity(marker);
  markers = [];
}

/** Replace the drawn broken-asset markers with `assets` (empty clears them). */
export function setBrokenAssets(assets: BrokenAsset[]): void {
  clear();
  const offset = getSceneOffset();
  for (const asset of assets) {
    const marker = engine.addEntity();
    Transform.create(marker, {
      position: Vector3.add(
        Vector3.create(asset.position.x, asset.position.y, asset.position.z),
        offset,
      ),
      scale: Vector3.create(MARKER_SIZE, MARKER_SIZE, MARKER_SIZE),
    });
    MeshRenderer.setBox(marker);
    Material.setPbrMaterial(marker, {
      albedoColor: Color4.create(MARKER_COLOR.r, MARKER_COLOR.g, MARKER_COLOR.b, 0.9),
      emissiveColor: MARKER_COLOR,
      emissiveIntensity: 0.6,
    });
    markers.push(marker);
  }
}
