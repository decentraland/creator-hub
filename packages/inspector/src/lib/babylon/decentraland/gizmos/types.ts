import type {
  Color3,
  IAxisDragGizmo,
  IPlaneDragGizmo,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { EcsEntity } from '../EcsEntity';

export interface IGizmoTransformer {
  type: GizmoType;
  setup(): void;
  cleanup(): void;
  setEntities(entities: EcsEntity[]): void;
  onDragStart(entities: EcsEntity[], gizmoNode: TransformNode): void;
  update(entities: EcsEntity[], gizmoNode: TransformNode): void;
  onDragEnd(): void;
  enable(): void;
  setUpdateCallbacks(...args: any[]): void;
  setWorldAligned(value: boolean): void;
  setSnapDistance(distance: number): void;
  setOnDragEndCallback?(callback: () => void): void;
}

export const enum GizmoType {
  POSITION = 'position',
  ROTATION = 'rotation',
  SCALE = 'scale',
  FREE = 'free',
}

export type GizmoEventCallback = () => void;

export interface GizmoAxis {
  xGizmo: IAxisDragGizmo;
  yGizmo: IAxisDragGizmo;
  zGizmo: IAxisDragGizmo;
}

export interface IPlaneDragGizmoWithMesh extends IPlaneDragGizmo {
  /**
   * Internal gizmo mesh - exposed for positioning.
   * Note: This is a protected property in Babylon.js
   */
  _gizmoMesh?: TransformNode;
}

export type Vector3Axis = 'x' | 'y' | 'z';

export type PlaneType = 'XY' | 'XZ' | 'YZ';

export interface PlaneConfig {
  type: PlaneType;
  dimensions: [number, number, number];
  position: Vector3;
  diffuse: Color3;
  emissive: Color3;
}
