import type { Entity, TransformType } from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/ecs-math';

import type { TransformInputAxis, TransformInputMode } from './grammar';

/**
 * Turns a committed numeric entry into absolute Transforms.
 *
 * Everything here is a DELTA applied about the selection's shared CENTROID, in
 * WORLD space, and the result is written back as each entity's LOCAL Transform —
 * so a nested entity lands where the user aimed regardless of its parent chain.
 * With a single entity the centroid is its own origin, so a rotation or scale
 * spins/grows it in place.
 *
 * Deliberately independent of any renderer: it reads Transforms and returns
 * Transforms, so the same result applies under Babylon and Bevy alike.
 */

/** Matches the reverse channel's floor — a zeroed scale can never be recovered. */
const MIN_SCALE = 0.01;

/** Trims the float noise a compose/decompose round-trip leaves in the composite. */
const PRECISION = 1e6;

export interface TransformInputDelta {
  mode: TransformInputMode;
  axis: TransformInputAxis | null;
  amount: number;
}

export interface TransformInputEdit {
  entity: Entity;
  transform: TransformType;
}

type Vec3 = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };

interface WorldTransform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

const IDENTITY: WorldTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** Unit quaternions only — which every Transform rotation is. */
function conjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function round(value: number): number {
  return Math.round(value * PRECISION) / PRECISION;
}

function roundVec(v: Vec3): Vec3 {
  return { x: round(v.x), y: round(v.y), z: round(v.z) };
}

function clampScaleComponent(value: number): number {
  if (Math.abs(value) >= MIN_SCALE) return value;
  return value < 0 ? -MIN_SCALE : MIN_SCALE;
}

function axisVector(axis: TransformInputAxis): Vec3 {
  return { x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0, z: axis === 'z' ? 1 : 0 };
}

/** The per-axis multiplier for a scale entry — uniform when no axis was picked. */
function scaleVector(axis: TransformInputAxis | null, factor: number): Vec3 {
  if (!axis) return { x: factor, y: factor, z: factor };
  return {
    x: axis === 'x' ? factor : 1,
    y: axis === 'y' ? factor : 1,
    z: axis === 'z' ? factor : 1,
  };
}

/**
 * Compose an entity's world TRS from its ancestor chain. TRS composition (no
 * shear), which matches how the renderers build their scene graphs; a non-uniform
 * scale above a rotation is the usual approximation and is the same one the
 * gizmos already make. `depthLimit` is a cycle guard — a malformed `parent` chain
 * must not hang the editor.
 */
export function getWorldTransform(
  entity: Entity,
  getTransform: (entity: Entity) => TransformType | null,
  depthLimit = 64,
): WorldTransform {
  const chain: TransformType[] = [];
  let current: Entity | undefined = entity;
  let depth = 0;
  while (current !== undefined && depth < depthLimit) {
    const transform = getTransform(current);
    if (!transform) break;
    chain.push(transform);
    current = transform.parent;
    depth++;
  }

  // Walk root-down so each step composes the accumulated parent with its child.
  let world: WorldTransform = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    const local = chain[i];
    const scaled = Vector3.multiply(world.scale, local.position);
    world = {
      position: Vector3.add(world.position, Vector3.rotate(scaled, world.rotation)),
      rotation: Quaternion.multiply(world.rotation, local.rotation),
      scale: Vector3.multiply(world.scale, local.scale),
    };
  }
  return world;
}

/** Undo a parent's world TRS to express a world point in that parent's space. */
function worldPositionToLocal(worldPosition: Vec3, parent: WorldTransform): Vec3 {
  const relative = Vector3.subtract(worldPosition, parent.position);
  const unrotated = Vector3.rotate(relative, conjugate(parent.rotation));
  return Vector3.divide(unrotated, parent.scale);
}

/**
 * Resolve a committed entry into the Transforms to write. Entities without a
 * Transform are skipped; an empty result means there was nothing to change.
 */
export function computeTransformInputEdits(
  entities: readonly Entity[],
  getTransform: (entity: Entity) => TransformType | null,
  delta: TransformInputDelta,
): TransformInputEdit[] {
  const targets = entities
    .map(entity => ({ entity, transform: getTransform(entity) }))
    .filter((t): t is { entity: Entity; transform: TransformType } => t.transform !== null);
  if (targets.length === 0) return [];

  const worlds = targets.map(t => getWorldTransform(t.entity, getTransform));
  const parents = targets.map(t =>
    t.transform.parent !== undefined
      ? getWorldTransform(t.transform.parent, getTransform)
      : IDENTITY,
  );

  const centroid = Vector3.scale(
    worlds.reduce((sum, w) => Vector3.add(sum, w.position), Vector3.Zero()),
    1 / worlds.length,
  );

  return targets.map((target, i) => {
    const world = worlds[i];
    const parent = parents[i];
    const local = target.transform;

    switch (delta.mode) {
      case 'position': {
        // No axis can't be committed for a move, but stay total rather than throw.
        const direction = delta.axis ? axisVector(delta.axis) : { x: 0, y: 0, z: 0 };
        const worldPosition = Vector3.add(world.position, Vector3.scale(direction, delta.amount));
        return {
          entity: target.entity,
          transform: { ...local, position: roundVec(worldPositionToLocal(worldPosition, parent)) },
        };
      }
      case 'rotation': {
        const rotation = Quaternion.fromAngleAxis(
          delta.amount,
          delta.axis ? axisVector(delta.axis) : { x: 0, y: 1, z: 0 },
        );
        // Spin the entity about the centroid, then carry the same rotation onto
        // its own orientation. `multiply(delta, current)` applies current first.
        const orbited = Vector3.add(
          centroid,
          Vector3.rotate(Vector3.subtract(world.position, centroid), rotation),
        );
        const worldRotation = Quaternion.multiply(rotation, world.rotation);
        const localRotation = Quaternion.multiply(conjugate(parent.rotation), worldRotation);
        return {
          entity: target.entity,
          transform: {
            ...local,
            position: roundVec(worldPositionToLocal(orbited, parent)),
            rotation: {
              x: round(localRotation.x),
              y: round(localRotation.y),
              z: round(localRotation.z),
              w: round(localRotation.w),
            },
          },
        };
      }
      case 'scale': {
        const factors = scaleVector(delta.axis, delta.amount);
        // The offset from the centroid scales in WORLD axes, but the entity's own
        // scale is applied on its LOCAL axes: a world-axis scale of a rotated
        // entity is a shear, which a TRS scale vector cannot hold. This is the
        // same compromise the scale gizmo's handles already make.
        const spread = Vector3.add(
          centroid,
          Vector3.multiply(Vector3.subtract(world.position, centroid), factors),
        );
        const scaled = Vector3.multiply(local.scale, factors);
        return {
          entity: target.entity,
          transform: {
            ...local,
            position: roundVec(worldPositionToLocal(spread, parent)),
            scale: roundVec({
              x: clampScaleComponent(scaled.x),
              y: clampScaleComponent(scaled.y),
              z: clampScaleComponent(scaled.z),
            }),
          },
        };
      }
    }
  });
}
