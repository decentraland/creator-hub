import { describe, expect, it } from 'vitest';
import type { Entity, TransformType } from '@dcl/ecs';
import { Quaternion, Vector3 } from '@dcl/ecs-math';

import { fromTransform } from '../../../components/EntityInspector/TransformInspector/utils';
import { computeTransformInputEdits, getWorldTransform } from './apply';

const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

function transform(partial: Partial<TransformType> = {}): TransformType {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: IDENTITY_ROTATION,
    scale: { x: 1, y: 1, z: 1 },
    ...partial,
  } as TransformType;
}

/** A lookup over a plain map, shaped like the Transform component's getOrNull. */
function lookup(entries: Record<number, TransformType>) {
  return (entity: Entity) => entries[entity as number] ?? null;
}

function round(value: number, places = 4) {
  return Number(value.toFixed(places));
}

function roundVec(v: { x: number; y: number; z: number }, places = 4) {
  return { x: round(v.x, places), y: round(v.y, places), z: round(v.z, places) };
}

describe('when moving a single entity by a typed amount', () => {
  it('should add the amount on the chosen axis and leave the others alone', () => {
    const entities = { 1: transform({ position: { x: 1, y: 2, z: 3 } }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'position',
      axis: 'x',
      amount: 4,
    });
    expect(edit.transform.position).toEqual({ x: 5, y: 2, z: 3 });
  });

  it('should subtract for a negative amount', () => {
    const entities = { 1: transform({ position: { x: 1, y: 2, z: 3 } }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'position',
      axis: 'y',
      amount: -0.5,
    });
    expect(edit.transform.position).toEqual({ x: 1, y: 1.5, z: 3 });
  });

  it('should not round a value the snap step would have quantised', () => {
    const entities = { 1: transform({ position: { x: 0, y: 0, z: 0 } }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'position',
      axis: 'x',
      amount: 0.17,
    });
    expect(edit.transform.position.x).toBe(0.17);
  });
});

describe('when rotating a single entity by a typed amount', () => {
  it('should rotate in place, matching a quaternion built from the same angle and axis', () => {
    const entities = { 1: transform({ position: { x: 4, y: 0, z: 4 } }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'rotation',
      axis: 'x',
      amount: 15,
    });
    // The centroid is its own origin, so a single entity never orbits.
    expect(edit.transform.position).toEqual({ x: 4, y: 0, z: 4 });

    const expected = Quaternion.fromAngleAxis(15, Vector3.create(1, 0, 0));
    expect(round(edit.transform.rotation.x)).toBe(round(expected.x));
    expect(round(edit.transform.rotation.w)).toBe(round(expected.w));
  });

  it('should compose onto an existing rotation rather than replace it', () => {
    const start = Quaternion.fromAngleAxis(30, Vector3.create(0, 1, 0));
    const entities = { 1: transform({ rotation: start }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'rotation',
      axis: 'y',
      amount: 60,
    });
    const expected = Quaternion.fromAngleAxis(90, Vector3.create(0, 1, 0));
    expect(round(edit.transform.rotation.y)).toBe(round(expected.y));
    expect(round(edit.transform.rotation.w)).toBe(round(expected.w));
  });
});

describe('when scaling a single entity by a typed amount', () => {
  it('should multiply only the chosen axis', () => {
    const entities = { 1: transform({ scale: { x: 2, y: 3, z: 4 } }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'scale',
      axis: 'x',
      amount: 2,
    });
    expect(edit.transform.scale).toEqual({ x: 4, y: 3, z: 4 });
  });

  it('should multiply every axis when no axis was picked', () => {
    const entities = { 1: transform() };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'scale',
      axis: null,
      amount: 2.5,
    });
    expect(edit.transform.scale).toEqual({ x: 2.5, y: 2.5, z: 2.5 });
  });

  it('should clamp away from zero so the entity stays recoverable', () => {
    const entities = { 1: transform({ scale: { x: 0.02, y: 1, z: 1 } }) };
    const [edit] = computeTransformInputEdits([1 as Entity], lookup(entities), {
      mode: 'scale',
      axis: 'x',
      amount: 0.1,
    });
    expect(edit.transform.scale.x).toBe(0.01);
  });
});

describe('when several entities are selected', () => {
  const selection = {
    1: transform({ position: { x: 0, y: 0, z: 0 } }),
    2: transform({ position: { x: 4, y: 0, z: 0 } }),
  };

  it('should move every entity by the same amount, holding the selection together', () => {
    const edits = computeTransformInputEdits([1, 2] as Entity[], lookup(selection), {
      mode: 'position',
      axis: 'z',
      amount: 2,
    });
    expect(edits.map(e => e.transform.position)).toEqual([
      { x: 0, y: 0, z: 2 },
      { x: 4, y: 0, z: 2 },
    ]);
  });

  it('should orbit each entity about the shared centroid when rotating', () => {
    const edits = computeTransformInputEdits([1, 2] as Entity[], lookup(selection), {
      mode: 'rotation',
      axis: 'y',
      amount: 90,
    });
    // Centroid is (2,0,0); a quarter turn about Y swaps the pair onto the Z line,
    // equidistant from it either way.
    const positions = edits.map(e => roundVec(e.transform.position));
    expect(positions[0].x).toBe(2);
    expect(positions[1].x).toBe(2);
    expect(Math.abs(positions[0].z)).toBe(2);
    expect(positions[1].z).toBe(-positions[0].z);
  });

  it('should spread the entities about the centroid when scaling', () => {
    const edits = computeTransformInputEdits([1, 2] as Entity[], lookup(selection), {
      mode: 'scale',
      axis: 'x',
      amount: 2,
    });
    // Centroid is (2,0,0); doubling pushes each offset (∓2) to ∓4.
    expect(edits.map(e => roundVec(e.transform.position))).toEqual([
      { x: -2, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
    ]);
    expect(edits.every(e => e.transform.scale.x === 2)).toBe(true);
  });
});

describe('when the entity is nested under a transformed parent', () => {
  it('should express a world-space move in the parent local space', () => {
    // Parent rotated a quarter turn about Y, so the world X axis is a local axis
    // of the parent's own frame — the child's local delta must account for it.
    const parentRotation = Quaternion.fromAngleAxis(90, Vector3.create(0, 1, 0));
    const entities = {
      1: transform({ position: { x: 10, y: 0, z: 0 }, rotation: parentRotation }),
      2: transform({ position: { x: 0, y: 0, z: 0 }, parent: 1 as Entity }),
    };
    const [edit] = computeTransformInputEdits([2 as Entity], lookup(entities), {
      mode: 'position',
      axis: 'x',
      amount: 3,
    });
    const world = getWorldTransform(edit.entity, lookup({ ...entities, 2: edit.transform }));
    expect(roundVec(world.position)).toEqual({ x: 13, y: 0, z: 0 });
  });

  it('should scale a child position by the parent scale on the way back to local', () => {
    const entities = {
      1: transform({ scale: { x: 2, y: 2, z: 2 } }),
      2: transform({ position: { x: 1, y: 0, z: 0 }, parent: 1 as Entity }),
    };
    const [edit] = computeTransformInputEdits([2 as Entity], lookup(entities), {
      mode: 'position',
      axis: 'x',
      amount: 4,
    });
    // World x goes 2 → 6, which is local x 3 under a parent scaled ×2.
    expect(roundVec(edit.transform.position)).toEqual({ x: 3, y: 0, z: 0 });
  });
});

describe('when an entity has no Transform', () => {
  it('should skip it rather than fail the whole entry', () => {
    const edits = computeTransformInputEdits([1, 99] as Entity[], lookup({ 1: transform() }), {
      mode: 'position',
      axis: 'x',
      amount: 1,
    });
    expect(edits.map(e => e.entity)).toEqual([1]);
  });
});

describe('when the parent chain is malformed', () => {
  it('should stop at the depth limit rather than loop forever', () => {
    const cyclic = {
      1: transform({ position: { x: 1, y: 0, z: 0 }, parent: 2 as Entity }),
      2: transform({ position: { x: 1, y: 0, z: 0 }, parent: 1 as Entity }),
    };
    const world = getWorldTransform(1 as Entity, lookup(cyclic), 8);
    expect(world.position.x).toBe(8);
  });
});

describe('when the result is read back by the Transform panel', () => {
  // The contract the user actually sees: typing 15 must put 15 in the panel, on
  // the axis they named. Worth crossing into the panel's own converter to assert
  // it — a quaternion that is "right" but reads back as -15 or as pitch/yaw swapped
  // would pass every test above.
  it.each(['x', 'y', 'z'] as const)('should show the typed angle on %s', axis => {
    const [edit] = computeTransformInputEdits([1 as Entity], lookup({ 1: transform() }), {
      mode: 'rotation',
      axis,
      amount: 15,
    });
    expect(fromTransform(edit.transform).rotation).toEqual({
      x: axis === 'x' ? '15.00' : '0.00',
      y: axis === 'y' ? '15.00' : '0.00',
      z: axis === 'z' ? '15.00' : '0.00',
    });
  });
});
