import * as BABYLON from '@babylonjs/core';
import type { Emitter } from 'mitt';
import mitt from 'mitt';
import { Vector3, Quaternion } from '@dcl/ecs-math';

import type { EcsEntity } from './EcsEntity';
import { ArcCameraManager } from './arcCamera';

type SpeedChangeEvent = { change: number };

enum SpeedIncrement {
  FASTER = 1,
  SLOWER = -1,
}

type AnimationData = {
  startPos: Vector3;
  endPos: Vector3;
  startQuat: Quaternion;
  endQuat: Quaternion;
  timePassed: number;
  duration: number;
};

export class CameraManager {
  private speeds: Array<number>;
  private speedIndex: number;
  private minY: number;
  private zoomSensitivity: number;
  private arcCameraManager: ArcCameraManager;
  private speedChangeObservable: Emitter<SpeedChangeEvent>;
  private getAspectRatio: () => number;
  private animation: AnimationData | null;
  private scene: BABYLON.Scene;

  constructor(
    scene: BABYLON.Scene,
    public inputSource: HTMLCanvasElement,
    speeds: Array<number>,
    initialSpeedIndex: number,
    minY: number,
    zoomSensitivity: number,
  ) {
    this.scene = scene;
    this.speeds = speeds;
    this.speedIndex = initialSpeedIndex;
    this.minY = minY;
    this.zoomSensitivity = zoomSensitivity;
    this.speedChangeObservable = mitt<SpeedChangeEvent>();
    this.getAspectRatio = () => {
      return inputSource.width / inputSource.height;
    };
    this.animation = null;

    // Create ArcCameraManager to handle ArcRotateCamera-specific logic
    // Pass speed change callback so wheel + right-click can change camera speed
    this.arcCameraManager = new ArcCameraManager(scene, inputSource, (faster: boolean) => {
      this.changeSpeed(faster ? SpeedIncrement.FASTER : SpeedIncrement.SLOWER);
    });

    scene.activeCamera?.detachControl();
    scene.activeCamera = this.arcCameraManager.getCamera();

    // There is a bug when holding RMB and moving out of the window
    // that prevents Babylon to release the button event
    // Seems to only occur under specific conditions (OSX + Chromium based browsers)
    window.addEventListener('mouseout', () => this.reattachControl());
    inputSource.addEventListener('mouseout', () => this.reattachControl());

    // Register render observer for animation and minY enforcement
    scene.registerBeforeRender(() => {
      this.onRenderFrame(scene);
    });
  }

  reattachControl() {
    this.arcCameraManager.reattachControl();
  }

  getCamera() {
    return this.arcCameraManager.getCamera();
  }

  getGlobalPosition() {
    return this.arcCameraManager.getCamera().globalPosition;
  }

  getSpeed() {
    return this.speeds[this.speedIndex];
  }

  getSpeedChangeObservable() {
    return this.speedChangeObservable;
  }

  setFreeCameraInvertRotation(invert: boolean) {
    this.arcCameraManager.setPanningInvert(invert);
  }

  centerViewOnEntity(entity: EcsEntity) {
    // get a bounding sphere from bounding box
    const { min, max } = entity.getHierarchyBoundingVectors();
    let center: BABYLON.Vector3;
    let radius: number;

    // Babylon returns (MAX_VALUE, MAX_VALUE, MAX_VALUE), (MIN_VALUE, MIN_VALUE, MIN_VALUE) for empty nodes
    if (min.x === Number.MAX_VALUE) {
      center = entity.getWorldMatrix().getTranslation();
      radius = 1;
    } else {
      center = min.add(max).scale(0.5);
      radius = max.subtract(center).length();
    }

    // Calculate ideal camera position
    const idealRadius = radius * 3; // Distance multiplier for framing

    // Animate camera to focus on entity
    this.arcCameraManager.centerViewOnTarget(center, idealRadius);
  }

  resetCamera() {
    this.arcCameraManager.resetCamera();
  }

  private changeSpeed(increment: SpeedIncrement) {
    if (increment === SpeedIncrement.FASTER) {
      if (this.speedIndex < this.speeds.length - 1) this.speedIndex += 1;
    } else {
      if (this.speedIndex > 0) this.speedIndex -= 1;
    }
    this.speedChangeObservable.emit('change', this.speeds[this.speedIndex]);
  }

  private onRenderFrame(scene: BABYLON.Scene) {
    const camera = this.arcCameraManager.getCamera();

    if (this.animation !== null) {
      const dt = scene.getEngine().getDeltaTime();
      this.animation.timePassed += dt / 1000;
      this.animation.timePassed = Math.min(this.animation.duration, this.animation.timePassed);
      const t = this.animation.timePassed / this.animation.duration;

      const position = Vector3.lerp(this.animation.startPos, this.animation.endPos, t);
      camera.position = new BABYLON.Vector3(position.x, position.y, position.z);

      const quat = Quaternion.slerp(this.animation.startQuat, this.animation.endQuat, t);
      const direction = Vector3.rotate(Vector3.create(0, 0, 1), quat);
      camera.target = camera.position.add(
        new BABYLON.Vector3(direction.x, direction.y, direction.z),
      );

      if (this.animation.timePassed >= this.animation.duration) this.animation = null;
    }

    // Ensure camera doesn't go below minimum Y
    if (camera.position.y <= this.minY) {
      camera.position.y = this.minY;
    }
  }
}
