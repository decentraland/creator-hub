import React, { useEffect, useRef } from 'react';

import type { WithSdkProps } from '../../../hoc/withSdk';
import { withSdk } from '../../../hoc/withSdk';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { InspectorFeatureFlags } from '../../../redux/feature-flags/types';
import { PARCEL_SIZE, GROUND_MESH_PREFIX } from '../../../lib/utils/scene';
import { ROOT, PLAYER, CAMERA } from '../../../lib/sdk/tree';

import './SceneMinimap.css';

const MINIMAP_SIZE = 180;
const PADDING = 14;
const ENTITY_DOT_RADIUS = 2.5;
const CAMERA_DOT_RADIUS = 3.5;
const FOV_CONE_LENGTH = 22;
const DIRECTION_LINE_LENGTH = 14;
const RENDER_INTERVAL_MS = 100;

const COLORS = {
  bg: 'rgba(31, 29, 35, 0.88)',
  parcelFill: 'rgba(80, 78, 88, 0.5)',
  parcelBorder: 'rgba(255, 255, 255, 0.25)',
  entity: '#6C6CFF',
  selectedEntity: '#FF6C6C',
  camera: '#FFFFFF',
  cameraFov: 'rgba(255, 255, 255, 0.08)',
  directionLine: 'rgba(255, 255, 255, 0.8)',
};

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function computeBounds(planes: { absolutePosition: { x: number; z: number } }[]): Bounds {
  if (planes.length === 0) {
    return { minX: 0, maxX: PARCEL_SIZE, minZ: 0, maxZ: PARCEL_SIZE };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const plane of planes) {
    const px = plane.absolutePosition.x;
    const pz = plane.absolutePosition.z;
    minX = Math.min(minX, px - PARCEL_SIZE / 2);
    maxX = Math.max(maxX, px + PARCEL_SIZE / 2);
    minZ = Math.min(minZ, pz - PARCEL_SIZE / 2);
    maxZ = Math.max(maxZ, pz + PARCEL_SIZE / 2);
  }

  const pad = PARCEL_SIZE * 0.5;
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

function worldToMinimap(worldX: number, worldZ: number, bounds: Bounds): { x: number; y: number } {
  const worldW = bounds.maxX - bounds.minX;
  const worldD = bounds.maxZ - bounds.minZ;
  const drawSize = MINIMAP_SIZE - PADDING * 2;
  const scale = drawSize / Math.max(worldW, worldD);

  const offsetX = (MINIMAP_SIZE - worldW * scale) / 2;
  const offsetY = (MINIMAP_SIZE - worldD * scale) / 2;

  return {
    x: (worldX - bounds.minX) * scale + offsetX,
    y: (bounds.maxZ - worldZ) * scale + offsetY,
  };
}

const SKIP_ENTITIES = new Set([ROOT, PLAYER, CAMERA]);

const SceneMinimap = withSdk<WithSdkProps>(({ sdk }) => {
  const enabled = useFeatureFlag(InspectorFeatureFlags.SceneMinimap);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_SIZE * dpr;
    canvas.height = MINIMAP_SIZE * dpr;
    ctx.scale(dpr, dpr);

    let lastRenderTime = 0;

    const renderMinimap = () => {
      const now = performance.now();
      if (now - lastRenderTime < RENDER_INTERVAL_MS) return;
      lastRenderTime = now;

      const planes = sdk.scene.meshes.filter(m => m.name.startsWith(GROUND_MESH_PREFIX));
      const bounds = computeBounds(planes);

      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.beginPath();
      ctx.roundRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE, 6);
      ctx.fill();

      // Parcel grid
      for (const plane of planes) {
        const px = plane.absolutePosition.x;
        const pz = plane.absolutePosition.z;
        const tl = worldToMinimap(px - PARCEL_SIZE / 2, pz + PARCEL_SIZE / 2, bounds);
        const br = worldToMinimap(px + PARCEL_SIZE / 2, pz - PARCEL_SIZE / 2, bounds);
        const w = br.x - tl.x;
        const h = br.y - tl.y;

        ctx.fillStyle = COLORS.parcelFill;
        ctx.fillRect(tl.x, tl.y, w, h);
        ctx.strokeStyle = COLORS.parcelBorder;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tl.x, tl.y, w, h);
      }

      // Entity dots
      const { Transform } = sdk.components;
      const selectedEntities = sdk.operations.getSelectedEntities();

      for (const [entity] of sdk.engine.getEntitiesWith(Transform)) {
        if (SKIP_ENTITIES.has(entity)) continue;
        const node = sdk.sceneContext.getEntityOrNull(entity);
        if (!node || !node.isEnabled()) continue;

        const pos = node.absolutePosition;
        const mapped = worldToMinimap(pos.x, pos.z, bounds);
        const isSelected = selectedEntities.includes(entity);

        ctx.beginPath();
        ctx.arc(
          mapped.x,
          mapped.y,
          isSelected ? ENTITY_DOT_RADIUS + 1.5 : ENTITY_DOT_RADIUS,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = isSelected ? COLORS.selectedEntity : COLORS.entity;
        ctx.fill();
      }

      // Camera indicator
      const camera = sdk.editorCamera.getCamera();
      const camPos = camera.position;
      const camTarget = camera.target;
      const camMapped = worldToMinimap(camPos.x, camPos.z, bounds);

      const dx = camTarget.x - camPos.x;
      const dz = camTarget.z - camPos.z;
      const len = Math.sqrt(dx * dx + dz * dz);

      if (len > 0.001) {
        const ndx = dx / len;
        const ndz = dz / len;

        // Minimap directions: x same as world x, y inverted from world z
        const mdx = ndx;
        const mdy = -ndz;

        // FOV cone
        const halfFov = camera.fov * 0.5;
        const cosF = Math.cos(halfFov);
        const sinF = Math.sin(halfFov);

        const leftWx = ndx * cosF + ndz * sinF;
        const leftWz = -ndx * sinF + ndz * cosF;
        const rightWx = ndx * cosF - ndz * sinF;
        const rightWz = ndx * sinF + ndz * cosF;

        ctx.beginPath();
        ctx.moveTo(camMapped.x, camMapped.y);
        ctx.lineTo(camMapped.x + leftWx * FOV_CONE_LENGTH, camMapped.y + -leftWz * FOV_CONE_LENGTH);
        ctx.lineTo(
          camMapped.x + rightWx * FOV_CONE_LENGTH,
          camMapped.y + -rightWz * FOV_CONE_LENGTH,
        );
        ctx.closePath();
        ctx.fillStyle = COLORS.cameraFov;
        ctx.fill();

        // Direction line
        ctx.beginPath();
        ctx.moveTo(camMapped.x, camMapped.y);
        ctx.lineTo(
          camMapped.x + mdx * DIRECTION_LINE_LENGTH,
          camMapped.y + mdy * DIRECTION_LINE_LENGTH,
        );
        ctx.strokeStyle = COLORS.directionLine;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Camera dot
      ctx.beginPath();
      ctx.arc(camMapped.x, camMapped.y, CAMERA_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.camera;
      ctx.fill();
    };

    const observer = sdk.scene.onAfterRenderObservable.add(renderMinimap);

    return () => {
      sdk.scene.onAfterRenderObservable.remove(observer);
    };
  }, [enabled, sdk]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="SceneMinimap"
      style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE, opacity: 0.9 }}
    />
  );
});

export default React.memo(SceneMinimap);
