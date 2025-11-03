import type { IAxisDragGizmo, TransformNode, Vector3 } from '@babylonjs/core';
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
  setGizmoManager?(gizmoManager: { calculateCentroid: () => Vector3 }): void;
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
